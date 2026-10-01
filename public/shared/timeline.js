// Timeline chart for the report: attention (with 95% band), baseline, retention, interest lane,
// drop-off and peak marks, segment overlays and a playhead. Drawn on canvas; click to seek, drag to zoom.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function smooth(values, window) {
  if (window <= 1) return values;
  const half = Math.floor(window / 2);
  return values.map((v, i) => {
    if (v === null) return null;
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      if (values[j] !== null) {
        sum += values[j];
        n++;
      }
    }
    return n ? sum / n : null;
  });
}

export class TimelineChart {
  constructor(canvas, tooltip, { onSeek } = {}) {
    this.canvas = canvas;
    this.tooltip = tooltip;
    this.onSeek = onSeek;
    this.report = null;
    this.overlays = [];
    this.playhead = null;
    this.view = null; // [start, end] seconds
    this.smoothSec = 15;
    this.drag = null;
    this.pad = { l: 44, r: 44, t: 14, b: 26 };
    this.laneH = 46;
    new ResizeObserver(() => this.draw()).observe(canvas);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.draw());
    canvas.addEventListener('mousemove', (e) => this.onMove(e));
    canvas.addEventListener('mouseleave', () => {
      this.tooltip.classList.add('hidden');
      this.hoverX = null;
      this.draw();
    });
    canvas.addEventListener('mousedown', (e) => {
      this.drag = { x0: this.localX(e), x1: this.localX(e) };
    });
    window.addEventListener('mouseup', (e) => this.onUp(e));
    canvas.addEventListener('dblclick', () => this.resetZoom());
  }

  setData(report, overlays = []) {
    this.report = report;
    this.overlays = overlays;
    const c = report.curve;
    if (!this.view) this.view = [c.start, c.start + c.attention.length];
    this.draw();
  }

  setSmoothing(sec) {
    this.smoothSec = sec;
    this.draw();
  }

  setPlayhead(sec) {
    this.playhead = sec;
    this.draw();
  }

  resetZoom() {
    if (!this.report) return;
    const c = this.report.curve;
    this.view = [c.start, c.start + c.attention.length];
    this.draw();
  }

  zoomTo(start, end) {
    this.view = [start, end];
    this.draw();
  }

  localX(e) {
    const r = this.canvas.getBoundingClientRect();
    return e.clientX - r.left;
  }

  xToSec(x) {
    const w = this.canvas.clientWidth - this.pad.l - this.pad.r;
    const [a, b] = this.view;
    return a + ((x - this.pad.l) / w) * (b - a);
  }

  secToX(s) {
    const w = this.canvas.clientWidth - this.pad.l - this.pad.r;
    const [a, b] = this.view;
    return this.pad.l + ((s - a) / (b - a)) * w;
  }

  onUp(e) {
    if (!this.drag) return;
    const { x0, x1 } = this.drag;
    this.drag = null;
    if (Math.abs(x1 - x0) > 8) {
      const a = this.xToSec(Math.min(x0, x1));
      const b = this.xToSec(Math.max(x0, x1));
      if (b - a >= 10) this.view = [a, b];
      this.draw();
    } else if (e.target === this.canvas) {
      this.onSeek?.(this.xToSec(x0));
    }
  }

  onMove(e) {
    if (!this.report) return;
    const x = this.localX(e);
    if (this.drag) this.drag.x1 = x;
    this.hoverX = x;
    const sec = this.xToSec(x);
    const c = this.report.curve;
    const i = Math.round(sec - c.start);
    if (i < 0 || i >= c.attention.length) {
      this.tooltip.classList.add('hidden');
      this.draw();
      return;
    }
    const att = smooth(c.attention, this.smoothSec)[i];
    const lines = [
      `<strong>${fmtTime(sec)}</strong>`,
      `Attention ${att === null ? 'n/a' : `${Math.round(att * 100)}%`}`,
      `Still watching ${Math.round(c.retention[i] * 100)}% (${c.viewers[i]})`,
      `Interest ${c.interest[i]} / 100 viewers`,
    ];
    for (const o of this.overlays) {
      const v = smooth(o.values, this.smoothSec)[i];
      if (v !== null && v !== undefined) lines.push(`<span style="color:${o.color}">●</span> ${o.label} ${Math.round(v * 100)}%`);
    }
    this.tooltip.innerHTML = lines.join('<br>');
    this.tooltip.classList.remove('hidden');
    const r = this.canvas.getBoundingClientRect();
    const left = Math.min(r.width - 190, Math.max(0, x + 12));
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `8px`;
    this.draw();
  }

  draw() {
    const cv = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (!W || !H) return;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!this.report) return;

    const c = this.report.curve;
    const { l, r, t, b } = this.pad;
    const mainBottom = H - b - this.laneH - 10;
    const laneTop = mainBottom + 10;
    const laneBottom = H - b;
    const y = (v) => t + (1 - v) * (mainBottom - t);
    const [va, vb] = this.view;
    const i0 = Math.max(0, Math.floor(va - c.start));
    const i1 = Math.min(c.attention.length - 1, Math.ceil(vb - c.start));
    const text = css('--text');
    const text2 = css('--text-2');
    const grid = css('--border');

    g.font = '11px system-ui, sans-serif';
    // Grid + y axis (attention %, left) and retention (right).
    g.strokeStyle = grid;
    g.fillStyle = text2;
    g.lineWidth = 1;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      g.beginPath();
      g.moveTo(l, y(v));
      g.lineTo(W - r, y(v));
      g.stroke();
      g.textAlign = 'right';
      g.fillText(`${v * 100}%`, l - 6, y(v) + 4);
    }
    g.textAlign = 'left';
    g.fillText('Watching', W - r + 6, t + 8);

    // Time ticks.
    const span = vb - va;
    const steps = [10, 30, 60, 120, 300, 600, 900, 1800];
    const step = steps.find((s) => span / s <= 10) ?? 3600;
    g.textAlign = 'center';
    for (let s = Math.ceil(va / step) * step; s <= vb; s += step) {
      const x = this.secToX(s);
      g.strokeStyle = grid;
      g.beginPath();
      g.moveTo(x, laneBottom);
      g.lineTo(x, laneBottom + 4);
      g.stroke();
      g.fillStyle = text2;
      g.fillText(fmtTime(s), x, H - 8);
    }

    // Drop-off shading and peak marks.
    const dropColor = css('--drop');
    const peakColor = css('--peak');
    g.globalAlpha = 0.12;
    g.fillStyle = dropColor;
    for (const d of this.report.dropoffs) {
      const x0 = this.secToX(d.start);
      const x1 = this.secToX(d.end);
      if (x1 < l || x0 > W - r) continue;
      g.fillRect(Math.max(l, x0), t, Math.min(W - r, x1) - Math.max(l, x0), mainBottom - t);
    }
    g.globalAlpha = 1;

    const path = (vals, color, width, dash = []) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.setLineDash(dash);
      g.beginPath();
      let pen = false;
      for (let i = i0; i <= i1; i++) {
        const v = vals[i];
        if (v === null || v === undefined) {
          pen = false;
          continue;
        }
        const x = this.secToX(c.start + i);
        if (pen) g.lineTo(x, y(v));
        else g.moveTo(x, y(v));
        pen = true;
      }
      g.stroke();
      g.setLineDash([]);
    };

    // 95% band.
    const lo = smooth(c.ciLow, this.smoothSec);
    const hi = smooth(c.ciHigh, this.smoothSec);
    g.fillStyle = css('--accent-soft');
    g.beginPath();
    let started = false;
    for (let i = i0; i <= i1; i++) {
      if (hi[i] === null) continue;
      const x = this.secToX(c.start + i);
      if (!started) g.moveTo(x, y(hi[i]));
      else g.lineTo(x, y(hi[i]));
      started = true;
    }
    for (let i = i1; i >= i0; i--) {
      if (lo[i] === null) continue;
      g.lineTo(this.secToX(c.start + i), y(lo[i]));
    }
    g.closePath();
    if (started) g.fill();

    path(c.retention, text2, 1.25, [2, 3]);
    path(c.baseline, text2, 1, [6, 4]);
    for (const o of this.overlays) path(smooth(o.values, this.smoothSec), o.color, 1.5);
    path(smooth(c.attention, this.smoothSec), css('--primary'), 2);

    // Interest lane: bars per second (max-pooled per pixel column).
    g.fillStyle = text2;
    g.fillText('Interest (spacebar)', l + 60, laneTop + 10);
    const maxI = Math.max(1, ...c.interest.slice(i0, i1 + 1));
    const cols = Math.max(1, Math.floor(W - l - r));
    const perCol = (i1 - i0 + 1) / cols;
    g.fillStyle = peakColor;
    for (let col = 0; col < cols; col++) {
      const a = i0 + Math.floor(col * perCol);
      const bI = Math.min(i1, i0 + Math.floor((col + 1) * perCol));
      let m = 0;
      for (let i = a; i <= bI; i++) m = Math.max(m, c.interest[i]);
      if (!m) continue;
      const h = (m / maxI) * (laneBottom - laneTop - 14);
      g.fillRect(l + col, laneBottom - h, Math.max(1, 1 / perCol), h);
    }
    g.strokeStyle = grid;
    g.beginPath();
    g.moveTo(l, laneBottom);
    g.lineTo(W - r, laneBottom);
    g.stroke();

    // Peak ticks on top edge.
    g.fillStyle = peakColor;
    this.report.peaks.forEach((p, i) => {
      const x = this.secToX(p.at);
      if (x < l || x > W - r) return;
      g.beginPath();
      g.moveTo(x, t);
      g.lineTo(x - 5, t - 9);
      g.lineTo(x + 5, t - 9);
      g.closePath();
      g.fill();
      if (i < 5) {
        g.textAlign = 'center';
        g.fillText(String(i + 1), x, t + 12);
      }
    });

    // Drag selection.
    if (this.drag && Math.abs(this.drag.x1 - this.drag.x0) > 4) {
      g.fillStyle = css('--accent-soft');
      g.fillRect(Math.min(this.drag.x0, this.drag.x1), t, Math.abs(this.drag.x1 - this.drag.x0), laneBottom - t);
    }
    // Hover + playhead.
    if (this.hoverX !== null && this.hoverX !== undefined && this.hoverX >= l && this.hoverX <= W - r) {
      g.strokeStyle = grid;
      g.beginPath();
      g.moveTo(this.hoverX, t);
      g.lineTo(this.hoverX, laneBottom);
      g.stroke();
    }
    if (this.playhead !== null) {
      const x = this.secToX(this.playhead);
      if (x >= l && x <= W - r) {
        g.strokeStyle = text;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, t - 4);
        g.lineTo(x, laneBottom);
        g.stroke();
      }
    }
  }
}
