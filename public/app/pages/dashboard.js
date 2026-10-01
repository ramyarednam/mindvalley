import { esc, fmtDuration, icon, pct } from '/shared/ui.js';
import { api, app, isAdmin } from '/app/app.js';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function card(t) {
  const cut = t.cuts[0] || {};
  const s = t.stats;
  const target = t.config.targetViewers || 1;
  return `<a class="tcard rise" href="#/test/${esc(t.id)}">
    <div class="tcard-media" style="${cut.posterUrl ? `background-image:url('${esc(cut.posterUrl)}'), var(--grad)` : ''}">
      <span class="pill ${esc(t.status)}">${t.status === 'live' ? 'Live' : t.status === 'draft' ? 'Draft' : 'Closed'}</span>
      ${cut.durationSec ? `<span class="dur">${fmtDuration(cut.durationSec)}</span>` : ''}
      <h3>${esc(t.title)}</h3>
    </div>
    <div class="tcard-body">
      <div class="tstats">
        <div class="tstat"><div class="v">${pct(s.avgAttention)}</div><div class="k">Attention</div></div>
        <div class="tstat"><div class="v">${pct(s.likedShare)}</div><div class="k">Liked it</div></div>
        <div class="tstat"><div class="v">${s.responses}</div><div class="k">Responses</div></div>
      </div>
      <div>
        <div class="row between small"><span class="muted">${s.valid} of ${target.toLocaleString()} viewers</span><span class="faint">${s.watching ? `${s.watching} watching now` : s.awaitingFeedback ? `${s.awaitingFeedback} feedback to come` : ''}</span></div>
        <div class="meter" style="margin-top:6px"><span style="width:${Math.min(100, (100 * s.valid) / target)}%"></span></div>
      </div>
      ${s.synthetic ? `<span class="faint tiny">Includes ${s.synthetic} synthetic viewers</span>` : ''}
    </div>
  </a>`;
}

export async function render(view) {
  view.innerHTML = `<div class="page-head"><div><h1>${greeting()}, ${esc(app.user.name.split(' ')[0])} 👋</h1><p class="muted">Here's how your screenings are doing.</p></div></div><div class="kpis">${'<div class="kpi skeleton" style="height:84px"></div>'.repeat(4)}</div>`;
  const tests = await api('/api/tests');

  const sum = (k) => tests.reduce((a, t) => a + (t.stats[k] || 0), 0);
  const withAtt = tests.filter((t) => t.stats.avgAttention !== null);
  const avgAtt = withAtt.length ? withAtt.reduce((a, t) => a + t.stats.avgAttention, 0) / withAtt.length : null;
  const live = tests.filter((t) => t.status === 'live').length;

  let filter = 'all';
  const draw = () => {
    const list = tests.filter((t) => filter === 'all' || t.status === filter);
    document.getElementById('grid').innerHTML = list.length
      ? list.map(card).join('')
      : `<div class="card empty" style="grid-column:1/-1"><div class="big">🎬</div><h2>${tests.length ? 'Nothing here' : 'No screenings yet'}</h2><p class="muted">${isAdmin() ? 'Create a screening from a Dropbox Replay link to get started.' : 'When an admin adds a screening, it will appear here.'}</p>${isAdmin() && !tests.length ? `<a class="btn btn-primary" href="#/new">${icon('plus')} New screening</a>` : ''}</div>`;
    for (const b of document.querySelectorAll('[data-filter]')) b.classList.toggle('on', b.dataset.filter === filter);
  };

  view.innerHTML = `
    <div class="page-head">
      <div><h1>${greeting()}, ${esc(app.user.name.split(' ')[0])} 👋</h1><p class="muted">Here's how your screenings are doing.</p></div>
      ${isAdmin() ? `<a class="btn btn-primary" href="#/new">${icon('plus')} New screening</a>` : ''}
    </div>
    <div class="kpis">
      <div class="kpi"><span class="kpi-ic good">${icon('film', 20)}</span><div><div class="k">Live now</div><div class="v">${live}</div><div class="s">of ${tests.length} screenings</div></div></div>
      <div class="kpi"><span class="kpi-ic">${icon('users', 20)}</span><div><div class="k">Viewers</div><div class="v">${sum('valid').toLocaleString()}</div><div class="s">${sum('watching')} watching right now</div></div></div>
      <div class="kpi"><span class="kpi-ic pink">${icon('message', 20)}</span><div><div class="k">Responses</div><div class="v">${sum('responses').toLocaleString()}</div><div class="s">${sum('awaitingFeedback')} still to give feedback</div></div></div>
      <div class="kpi"><span class="kpi-ic warn">${icon('eye', 20)}</span><div><div class="k">Avg attention</div><div class="v">${pct(avgAtt)}</div><div class="s">across all screenings</div></div></div>
    </div>
    <div class="row between" style="margin-bottom:16px">
      <h2 style="margin:0">Screenings</h2>
      <div class="tabs-pills">${['all', 'live', 'draft', 'closed'].map((f) => `<button data-filter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
    </div>
    <div class="test-grid" id="grid"></div>`;
  for (const b of view.querySelectorAll('[data-filter]')) b.onclick = () => ((filter = b.dataset.filter), draw());
  draw();
}
