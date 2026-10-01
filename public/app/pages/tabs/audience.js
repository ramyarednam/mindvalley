import { TimelineChart } from '/shared/timeline.js';
import { cssVar, esc, hbars, pct } from '/shared/ui.js';
import { api } from '/app/app.js';
import { qs } from '/app/pages/test.js';

const KEYS = { age_band: 'Age', gender: 'Gender', country: 'Country', member: 'Member status' };
const COLORS = ['--line-2', '--line-3', '--line-4', '--line-5', '--line-1'];

export async function render(el, test, vs, _rerender, key = 'age_band') {
  const [r, responses] = await Promise.all([api(`/api/tests/${test.id}/report?${qs(vs, { segment: key })}`), api(`/api/tests/${test.id}/responses?${qs(vs)}`)]);
  const seg = r.segments.find((s) => s.key === key);
  const overlays = (seg?.options ?? []).filter((o) => !o.hidden && o.attention).map((o, i) => ({ label: o.value, values: o.attention, color: cssVar(COLORS[i % COLORS.length]) }));

  // Liked share and relevance by group, from the questionnaire answers.
  const groups = new Map();
  for (const x of responses) {
    const g = x[key];
    if (!g || !x.feedback?.liked) continue;
    const e = groups.get(g) ?? { n: 0, liked: 0, rel: 0, relN: 0 };
    e.n++;
    if (x.feedback.liked === 'loved' || x.feedback.liked === 'liked') e.liked++;
    if (x.feedback.relevance) {
      e.rel += x.feedback.relevance;
      e.relN++;
    }
    groups.set(g, e);
  }
  const groupRows = [...groups.entries()].sort((a, b) => b[1].n - a[1].n);

  el.innerHTML = `
    <div class="stack">
      <div class="toolbar"><div class="tabs-pills">${Object.entries(KEYS).map(([k, v]) => `<button data-key="${k}" class="${k === key ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <div class="card chart-card">
        <div class="card-head"><h3>Attention by ${KEYS[key].toLowerCase()}</h3></div>
        <canvas id="seg-chart"></canvas><div id="seg-tip" class="chart-tip hidden"></div>
        <div class="legend"><span><i style="border-color:var(--primary)"></i>Everyone</span>${overlays.map((o) => `<span><i style="border-color:${o.color}"></i>${esc(o.label)}</span>`).join('')}</div>
        ${seg?.options.some((o) => o.hidden) ? `<p class="faint tiny" style="margin:8px 0 0">Groups with fewer viewers than the minimum are left off the chart so small samples don't mislead.</p>` : ''}
      </div>
      <div class="pair">
        <div class="card"><h3>Who watched</h3>${hbars((seg?.options ?? []).map((o) => ({ label: esc(o.value), value: o.n, sub: o.n })))}</div>
        <div class="card"><h3>Who liked it</h3>${groupRows.length ? hbars(groupRows.map(([g, e]) => ({ label: esc(g), value: e.liked / e.n, sub: `${pct(e.liked / e.n)} · ${e.n}` })), { max: 1, color: 'var(--line-4)' }) : '<p class="faint small">No feedback yet.</p>'}
          ${groupRows.length ? `<h3 style="margin-top:18px">Topic relevance (1–5)</h3>${hbars(groupRows.filter(([, e]) => e.relN).map(([g, e]) => ({ label: esc(g), value: e.rel / e.relN, sub: (e.rel / e.relN).toFixed(1) })), { max: 5, color: 'var(--line-2)' })}` : ''}</div>
      </div>
    </div>`;
  const chart = new TimelineChart(document.getElementById('seg-chart'), document.getElementById('seg-tip'));
  chart.setSmoothing(30);
  chart.setData(r, overlays);
  for (const b of el.querySelectorAll('[data-key]')) b.onclick = () => render(el, test, vs, _rerender, b.dataset.key);
}
