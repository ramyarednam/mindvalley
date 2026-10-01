import { TimelineChart } from '/shared/timeline.js';
import { esc, fmtTime, icon, pct } from '/shared/ui.js';
import { api, onCleanup } from '/app/app.js';
import { qs } from '/app/pages/test.js';

function momentRows(list, kind) {
  if (!list.length) return '<p class="faint small">None found yet.</p>';
  return list
    .map(
      (m, i) => `<div class="moment-row" data-seek="${m.start}"><span class="rank ${kind}">${i + 1}</span><div>
        <strong class="num">${fmtTime(m.start)} – ${fmtTime(m.end)}</strong>
        <span class="faint small"> · ${kind === 'peak' ? `${m.score} presses / 100 viewers` : `${m.score} pts below normal`} · attention ${pct(m.attention)}</span>
        ${m.transcript ? `<q>${esc(m.transcript)}</q>` : ''}</div></div>`,
    )
    .join('');
}

export async function render(el, test, vs) {
  const r = await api(`/api/tests/${test.id}/report?${qs(vs)}`);
  el.innerHTML = `
    <div class="stack">
      <div class="two">
        <div class="player-box"><video id="team-player" controls playsinline></video></div>
        <div class="card" style="max-height:100%;overflow:auto">
          <div class="card-head"><h3>${icon('trendUp', 16)} Where they leaned in</h3></div><div id="peaks">${momentRows(r.peaks.slice(0, 5), 'peak')}</div>
        </div>
      </div>
      <div class="card chart-card">
        <div class="card-head"><h3>Second by second</h3>
          <div class="row"><select id="smooth" aria-label="Smoothing" style="width:auto"><option value="1">No smoothing</option><option value="5">5 s smoothing</option><option value="15" selected>15 s smoothing</option><option value="60">60 s smoothing</option></select></div></div>
        <canvas id="chart" aria-label="Attention, still watching and interest over the episode"></canvas>
        <div id="chart-tip" class="chart-tip hidden"></div>
        <div class="legend"><span><i style="border-color:var(--primary)"></i>Attention</span><span><i class="box" style="background:var(--accent-soft)"></i>95% range</span><span><i class="dash" style="border-color:var(--text-2)"></i>Normal for this episode</span><span><i class="dot" style="border-color:var(--text-2)"></i>Still watching</span><span><i class="box" style="background:var(--peak)"></i>Spacebar</span><span><i class="box" style="background:var(--drop);opacity:.3"></i>Drop-off</span></div>
        <p class="faint tiny" style="margin:8px 0 0">Click to jump the player · drag to zoom · double-click to zoom out</p>
      </div>
      <div class="cols3">
        <div class="card"><div class="card-head"><h3>${icon('trendUp', 16)} All peaks</h3></div>${momentRows(r.peaks, 'peak')}</div>
        <div class="card"><div class="card-head"><h3>${icon('trendDown', 16)} Where they drifted</h3></div>${momentRows(r.dropoffs, 'drop')}</div>
        <div class="card"><div class="card-head"><h3>${icon('download', 16)} Markers for editors</h3></div>
          <p class="muted small">Import the peaks (green) and drop-offs (red) straight onto your timeline, with the transcript text.</p>
          <div class="stack" style="--gap:8px">
            <a class="btn" href="/api/tests/${esc(test.id)}/export/xml?${qs(vs)}">${icon('download', 15)} Premiere Pro (XML)</a>
            <a class="btn" href="/api/tests/${esc(test.id)}/export/edl?${qs(vs)}">${icon('download', 15)} DaVinci Resolve (EDL)</a>
            <a class="btn" href="/api/tests/${esc(test.id)}/export/csv?${qs(vs)}">${icon('download', 15)} Spreadsheet (CSV)</a>
          </div></div>
      </div>
    </div>`;

  const video = document.getElementById('team-player');
  const chart = new TimelineChart(document.getElementById('chart'), document.getElementById('chart-tip'), {
    onSeek: (sec) => {
      video.currentTime = sec;
      chart.setPlayhead(sec);
    },
  });
  chart.setData(r);
  video.addEventListener('timeupdate', () => chart.setPlayhead(video.currentTime));
  document.getElementById('smooth').onchange = (e) => chart.setSmoothing(Number(e.target.value));

  let hls;
  onCleanup(() => hls?.destroy());
  const stream = await api(`/api/tests/${test.id}/stream?${qs(vs)}`);
  if (!stream.src) {
    // No playable stream (for example in the shareable preview): show the poster instead.
    const cut = test.cuts.find((c) => c.id === vs.cut) || test.cuts[0];
    if (cut?.posterUrl) video.poster = cut.posterUrl;
    video.controls = false;
  } else if (stream.kind === 'hls' && window.Hls?.isSupported()) {
    hls = new window.Hls({ capLevelToPlayerSize: true });
    hls.loadSource(stream.src);
    hls.attachMedia(video);
  } else video.src = stream.src;

  const seek = (s) => {
    video.currentTime = Math.max(0, s - 3);
    video.play().catch(() => {});
    chart.zoomTo(Math.max(r.curve.start, s - 120), Math.min(r.range.end, s + 180));
  };
  for (const row of el.querySelectorAll('[data-seek]')) row.onclick = () => seek(Number(row.dataset.seek));
  // Another tab (hooks, feedback) can ask to open the player at a moment.
  const pending = sessionStorage.getItem('pw:seek');
  if (pending) {
    sessionStorage.removeItem('pw:seek');
    video.addEventListener('loadedmetadata', () => seek(Number(pending)), { once: true });
  }
}
