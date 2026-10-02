import { esc, fmtTime, hbars, icon, pct, ring } from '/shared/ui.js';
import { api } from '/app/app.js';
import { qs } from '/app/pages/test.js';
import { quoteList, wireSeek } from '/app/pages/tabs/feedback.js';

export const REASON_LABELS = {
  interrupted: '📞 Something came up',
  break: '☕ Needed a break',
  losing_interest: '😴 Losing interest',
  too_long: "⏳ Too long, finish later",
  other: '🤷 Another reason',
};

const WHO = (w) => [w.age_band, w.gender, w.country, w.member].filter(Boolean).map(esc).join(' · ');

/** Still-watching curve with the points where people stopped as bars underneath, drawn to one time scale. */
function stopChart(d) {
  const W = 1000, H = 260, L = 44, R = 16, T = 14, B = 34;
  const plotH = 150, barTop = T + plotH + 18, barH = H - B - barTop;
  const span = d.range.end - d.range.start;
  const x = (t) => L + ((t - d.range.start) / span) * (W - L - R);
  const y = (v) => T + (1 - v) * plotH;
  // Everyone who started, minus each viewer at the moment they stopped: a step down per stop.
  const stops = d.stopped.map((s) => s.at).sort((a, b) => a - b);
  let left = d.viewers;
  let path = `M${x(d.range.start).toFixed(1)},${y(1).toFixed(1)}`;
  for (const at of stops) {
    path += `L${x(at).toFixed(1)},${y(left / d.viewers).toFixed(1)}`;
    left -= 1;
    path += `L${x(at).toFixed(1)},${y(left / d.viewers).toFixed(1)}`;
  }
  path += `L${x(d.range.end).toFixed(1)},${y(left / d.viewers).toFixed(1)}`;
  const area = `${path}L${x(d.range.end).toFixed(1)},${y(0)}L${x(d.range.start).toFixed(1)},${y(0)}Z`;
  const maxBin = Math.max(1, ...d.stopBins.map((b) => b.count));
  const bars = d.stopBins
    .map((b) => {
      const h = (b.count / maxBin) * barH;
      return b.count ? `<rect x="${x(b.start) + 1}" y="${barTop + barH - h}" width="${Math.max(2, x(b.end) - x(b.start) - 2)}" height="${h}" rx="3" fill="var(--drop)" opacity="0.75"><title>${b.count} stopped between ${fmtTime(b.start)} and ${fmtTime(b.end)}</title></rect><text x="${(x(b.start) + x(b.end)) / 2}" y="${barTop + barH - h - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-2)">${b.count}</text>` : '';
    })
    .join('');
  const ticks = [];
  const tickStep = span > 3600 ? 900 : span > 1200 ? 300 : 60;
  for (let t = Math.ceil(d.range.start / tickStep) * tickStep; t <= d.range.end; t += tickStep) ticks.push(`<line x1="${x(t)}" x2="${x(t)}" y1="${T}" y2="${H - B}" stroke="var(--border)"/><text x="${x(t)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="var(--text-3)">${fmtTime(t)}</text>`);
  const grid = [0, 0.5, 1].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="var(--text-3)">${v * 100}%</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Share still watching over the episode, with the points where viewers stopped">
    ${ticks.join('')}${grid}
    <path d="${area}" fill="var(--primary-soft)"/><path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>
    <text x="${L + 6}" y="${barTop + 2}" font-size="12" font-weight="700" fill="var(--text-2)">Where viewers stopped</text>
    ${bars}
  </svg>`;
}

export async function render(el, test, vs) {
  const d = await api(`/api/tests/${test.id}/dropoffs?${qs(vs)}`);
  if (!d.viewers) {
    el.innerHTML = `<div class="card empty"><div class="big">📉</div><h2>No viewers yet</h2><p class="muted">When people watch, you'll see where they stopped, why, and what dragged.</p></div>`;
    return;
  }
  const reasonRows = Object.entries(d.reasons).sort((a, b) => b[1] - a[1]);
  const topReason = reasonRows[0];
  el.innerHTML = `
    <div class="stack">
      <div class="metrics">
        <div class="card tight metric-ring">${ring(d.finished / d.viewers, { size: 76, stroke: 8, color: 'var(--good)' })}<div><div class="k">Watched to the end</div><div class="s">${d.finished} of ${d.viewers} viewers</div></div></div>
        <div class="card tight metric-ring"><div class="big-num" style="color:var(--drop)">${d.stopped.length}</div><div><div class="k">Stopped before the end</div><div class="s">${d.stopped.filter((s) => s.status === 'watching').length} may still come back</div></div></div>
        <div class="card tight metric-ring"><div class="big-num">${d.saves}</div><div><div class="k">"Save & finish later"</div><div class="s">${topReason ? `Most often: ${REASON_LABELS[topReason[0]] || esc(topReason[0])}` : 'Nobody paused to leave yet'}</div></div></div>
      </div>

      <div class="card"><div class="card-head"><div><h3>${icon('trendDown', 16)} Still watching, and where people left</h3><p class="faint small" style="margin:0">The line is the share of viewers still watching. Red bars count viewers whose last moment watched was in that stretch.</p></div></div>
        <div style="overflow-x:auto">${stopChart(d)}</div></div>

      <div class="card"><div class="card-head"><div><h3>Biggest attention drops</h3><p class="faint small" style="margin:0">Stretches where attention fell 10+ points below normal for 20 s or more, with what viewers did and said there.</p></div></div>
        ${
          d.dropoffs.length
            ? `<div class="drops">${d.dropoffs
                .map(
                  (dr, i) => `<div class="drop">
                <div class="drop-head"><span class="rank drop">${i + 1}</span><div class="grow"><a href="#" data-seek="${dr.start}" class="num" style="font-weight:800">${icon('play', 12)} ${fmtTime(dr.start)} – ${fmtTime(dr.end)}</a>
                  <div class="faint small">Attention fell to ${pct(dr.attention)} · ${dr.score} pts below normal</div></div>
                  <div class="drop-stats"><span title="Viewers who pressed B here">😴 ${dr.boredPresses} bored</span><span title="Viewers whose viewing ended here">⏹ ${dr.stoppedHere} stopped</span></div></div>
                ${dr.transcript ? `<q class="drop-q">${esc(dr.transcript)}</q>` : ''}
                ${dr.notes.length ? `<div class="quotes" style="margin-top:10px">${dr.notes.map((q) => `<div class="quote"><span class="at">${fmtTime(q.at)}</span>${esc(q.text)}<div class="who">${WHO(q.who)}</div></div>`).join('')}</div>` : '<p class="faint tiny" style="margin:8px 0 0">No comments on this stretch yet.</p>'}
              </div>`,
                )
                .join('')}</div>`
            : '<p class="faint">No clear drops yet.</p>'
        }
      </div>

      <div class="pair">
        <div class="card"><h3>Why people stopped</h3>${reasonRows.length ? hbars(reasonRows.map(([k, n]) => ({ label: REASON_LABELS[k] || esc(k), value: n, sub: n })), { color: 'var(--drop)' }) : '<p class="faint small">No one has used "Save & finish later" yet.</p>'}</div>
        <div class="card"><h3>Who stopped, and where</h3>
          ${d.stopped.length ? `<div class="stops">${d.stopped
            .map((s) => `<div class="stop-row"><strong class="num">${esc(s.id)}</strong><span class="faint small">${WHO(s.who)}</span><a href="#" data-seek="${s.at}" class="num">${fmtTime(s.at)}</a><span class="small">${s.reason ? REASON_LABELS[s.reason] || esc(s.reason) : '<span class="faint">closed without saying</span>'}</span><span class="pill plain">${s.status === 'watching' ? 'may come back' : 'stopped'}</span></div>`)
            .join('')}</div>` : '<p class="faint small">Everyone who started has finished.</p>'}</div>
      </div>

      <div class="pair">
        <div class="card"><div class="card-head"><h3>😴 What dragged, in their words</h3><span class="faint small">${d.boredNotes.length}</span></div>${quoteList(d.boredNotes, { empty: 'When viewers press B, they are asked why that part dragged. Their answers appear here.' })}</div>
        <div class="card"><div class="card-head"><h3>✂️ What they'd cut</h3><span class="faint small">${d.wouldCut.length}</span></div>${quoteList(d.wouldCut)}</div>
      </div>
    </div>`;
  wireSeek(el, test);
}
