import { ago, esc, fmtTime, FEELINGS, LIKED, RELEVANCE_LABELS, icon } from '/shared/ui.js';
import { api, isAdmin } from '/app/app.js';
import { qs } from '/app/pages/test.js';

const STATUS = { started: 'Setting up', watching: 'Watching', watched: 'Feedback to come', completed: 'Done', abandoned: 'Stopped' };
const REASONS = { calibration_failed: 'Calibration failed', watched_too_little: 'Watched too little', face_not_visible: 'Face not visible', failed_attention_checks: 'Missed attention checks', suspicious_key_pattern: 'Odd key pattern' };
const likedOf = (k) => LIKED.find((l) => l.key === k);

function drawer(x, test) {
  const f = x.feedback || {};
  const qa = (q, a) => (a ? `<div class="qa"><div class="q">${q}</div><div>${a}</div></div>` : '');
  const lines = x.standoutLines || [];
  const bg = document.createElement('div');
  bg.className = 'drawer-bg';
  const d = document.createElement('aside');
  d.className = 'drawer';
  d.innerHTML = `
    <div class="row between"><h2 style="margin:0">Viewer ${esc(x.id)}</h2><button class="btn-ghost" id="close" aria-label="Close">${icon('x')}</button></div>
    <p class="muted small">${[x.age_band, x.gender, x.country, x.member].filter(Boolean).map(esc).join(' · ')}${x.synthetic ? ' · synthetic' : ''}${x.pid ? ` · panel ID ${esc(x.pid)}` : ''}</p>
    <div class="row" style="margin-bottom:18px"><span class="pill plain">${STATUS[x.status] || esc(x.status)}</span>${x.valid === 1 ? '<span class="pill live">Counted</span>' : x.valid === 0 ? `<span class="pill closed">${esc(REASONS[x.excludeReason] || x.excludeReason)}</span>` : ''}<span class="faint small">Watched to ${fmtTime(x.reached)}</span></div>
    ${qa('Feeling', f.feeling ? `${FEELINGS[f.feeling - 1]} ${f.feeling} / 5` : '')}
    ${qa('Topic relevance', f.relevance ? `${f.relevance} / 5 · ${RELEVANCE_LABELS[f.relevance - 1]}` : '')}
    ${qa('Did they like it', f.liked ? `${likedOf(f.liked)?.emoji} ${likedOf(f.liked)?.label}` : '')}
    ${qa('Would recommend', f.recommend !== undefined ? `${f.recommend} / 10` : '')}
    ${qa('Lines that stood out', lines.map((c) => `<div class="quote"><span class="at">${fmtTime(c.start)}</span>“${esc(c.text)}”</div>`).join(''))}
    ${qa('Why they stood out', esc(f.standoutWhy || ''))}
    ${qa('Their marked moments', Object.entries(f.momentNotes || {}).map(([at, t]) => `<div class="quote"><span class="at">${fmtTime(Number(at))}</span>${esc(t)}</div>`).join(''))}
    ${qa('Describe it to a friend', esc(f.oneLiner || ''))}
    ${qa('Title they would click', esc(f.titleIdea || ''))}
    ${qa('What they would cut', esc(f.wouldCut || ''))}
    ${(test.config.survey || []).map((q) => qa(esc(q.text), esc(f.custom?.[q.id] ?? ''))).join('')}
    ${!Object.keys(f).length ? '<p class="faint">No feedback yet.</p>' : ''}`;
  document.body.append(bg, d);
  const close = () => {
    bg.remove();
    d.remove();
  };
  bg.onclick = close;
  d.querySelector('#close').onclick = close;
}

export async function render(el, test, vs) {
  const rows = await api(`/api/tests/${test.id}/responses?${qs(vs)}`);
  let filter = 'all';
  let q = '';
  const draw = () => {
    const list = rows.filter((x) => (filter === 'all' || (filter === 'feedback' ? x.status === 'completed' : filter === 'waiting' ? x.status === 'watched' : x.status === 'watching' || x.status === 'started')) && (!q || JSON.stringify(x).toLowerCase().includes(q)));
    document.getElementById('resp-body').innerHTML = list.length
      ? list
          .slice(0, 500)
          .map(
            (x) => `<tr data-id="${esc(x.id)}">
              <td class="num"><strong>${esc(x.id)}</strong>${x.synthetic ? ' <span class="faint tiny">sim</span>' : ''}${isAdmin() && x.pid ? `<div class="faint tiny">${esc(x.pid)}</div>` : ''}</td>
              <td class="small muted">${[x.age_band, x.gender, x.country, x.member].filter(Boolean).map(esc).join(' · ')}</td>
              <td><span class="pill plain">${STATUS[x.status] || esc(x.status)}</span></td>
              <td class="num">${fmtTime(x.reached)}</td>
              <td style="font-size:1.2rem">${x.feedback?.feeling ? FEELINGS[x.feedback.feeling - 1] : ''} ${x.feedback?.liked ? likedOf(x.feedback.liked)?.emoji : ''}</td>
              <td class="small">${esc((x.feedback?.standoutWhy || x.feedback?.oneLiner || '').slice(0, 80))}</td>
              <td>${x.valid === 1 ? `<span class="pill live plain">${icon('check', 12)}</span>` : x.valid === 0 ? `<span class="pill closed plain" title="${esc(REASONS[x.excludeReason] || '')}">Excluded</span>` : ''}</td>
              <td class="faint small">${ago(x.feedbackAt || x.startedAt)}</td>
            </tr>`,
          )
          .join('')
      : '<tr><td colspan="8" class="faint center" style="padding:30px">No viewers match.</td></tr>';
    for (const tr of document.querySelectorAll('#resp-body tr[data-id]')) tr.onclick = () => drawer(rows.find((x) => x.id === tr.dataset.id), test);
    for (const b of el.querySelectorAll('[data-f]')) b.classList.toggle('on', b.dataset.f === filter);
  };
  const count = (fn) => rows.filter(fn).length;
  el.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="tabs-pills">
          <button data-f="all">All ${rows.length}</button>
          <button data-f="feedback">Gave feedback ${count((x) => x.status === 'completed')}</button>
          <button data-f="waiting">Feedback to come ${count((x) => x.status === 'watched')}</button>
          <button data-f="watching">Watching ${count((x) => x.status === 'watching' || x.status === 'started')}</button>
        </div>
        <input type="search" id="resp-q" placeholder="Search answers, countries…" style="max-width:280px" />
      </div>
      <div style="overflow:auto"><table class="resp-table"><thead><tr><th>Viewer</th><th>Audience</th><th>Status</th><th>Watched to</th><th>Reaction</th><th>What stood out</th><th>Quality</th><th>When</th></tr></thead><tbody id="resp-body"></tbody></table></div>
      ${rows.length > 500 ? '<p class="faint tiny">Showing the latest 500. Use search to find others.</p>' : ''}
    </div>`;
  for (const b of el.querySelectorAll('[data-f]')) b.onclick = () => ((filter = b.dataset.f), draw());
  document.getElementById('resp-q').oninput = (e) => ((q = e.target.value.toLowerCase()), draw());
  draw();
}
