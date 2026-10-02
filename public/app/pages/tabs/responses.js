import { ago, esc, fmtTime, FEELINGS, LIKED, RELEVANCE_LABELS, icon } from '/shared/ui.js';
import { api, isAdmin } from '/app/app.js';
import { qs } from '/app/pages/test.js';
import { REASON_LABELS } from '/app/pages/tabs/dropoffs.js';

const STATUS = { started: 'Setting up', watching: 'Watching', watched: 'Feedback to come', completed: 'Finished', abandoned: 'Stopped' };
const STATUS_CLASS = { completed: 'live', watched: 'draft', watching: 'admin', abandoned: 'closed', started: 'plain' };
const REASONS = { calibration_failed: 'Calibration failed', watched_too_little: 'Watched too little', face_not_visible: 'Face not visible', failed_attention_checks: 'Missed attention checks', suspicious_key_pattern: 'Odd key pattern' };
const likedOf = (k) => LIKED.find((l) => l.key === k);
const WHO = (x) => [x.age_band, x.gender, x.country, x.member].filter(Boolean).map(esc).join(' · ');

/** One viewer's journey: how far they got, where they leaned in, got bored, or saved to finish later. */
export function journeyBar(x, { tall = false } = {}) {
  const { start, end } = x.range;
  const pos = (t) => `${Math.max(0, Math.min(100, (100 * (t - start)) / (end - start)))}%`;
  const done = x.status === 'watched' || x.status === 'completed';
  const reached = done ? end : x.reached;
  const marks = [
    ...x.journey.interest.map((t) => `<span class="jm int" style="left:${pos(t)}" title="✨ Interesting at ${fmtTime(t)}"></span>`),
    ...x.journey.bored.map((t) => `<span class="jm bor" style="left:${pos(t)}" title="😴 Boring at ${fmtTime(t)}"></span>`),
    ...x.journey.saves.map((s) => `<span class="jm sav" style="left:${pos(s.at)}" title="⏸ Saved at ${fmtTime(s.at)}: ${esc(REASON_LABELS[s.reason] || s.reason)}"></span>`),
  ].join('');
  return `<div class="journey ${tall ? 'tall' : ''}" role="img" aria-label="Watched to ${fmtTime(reached)}"><span class="jfill" style="width:${pos(reached)}"></span>${!done && x.status !== 'started' ? `<span class="jstop" style="left:${pos(reached)}" title="Last watched ${fmtTime(reached)}"></span>` : ''}${marks}</div>`;
}

function attentionSvg(buckets, x) {
  const W = 600, H = 120, P = 6;
  const n = buckets.length;
  let d = '';
  buckets.forEach((v, i) => {
    if (v === null) return;
    d += `${d && buckets[i - 1] !== null ? 'L' : 'M'}${(P + (i / (n - 1)) * (W - 2 * P)).toFixed(1)},${(P + (1 - v) * (H - 2 * P)).toFixed(1)}`;
  });
  const px = (t) => P + ((t - x.range.start) / (x.range.end - x.range.start)) * (W - 2 * P);
  const marks = [...x.journey.interest.map((t) => `<circle cx="${px(t)}" cy="${P + 4}" r="4" fill="var(--peak)"/>`), ...x.journey.bored.map((t) => `<circle cx="${px(t)}" cy="${H - P - 4}" r="4" fill="var(--text-3)"/>`)].join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="This viewer's attention over the episode"><line x1="${P}" x2="${W - P}" y1="${H / 2}" y2="${H / 2}" stroke="var(--border)" stroke-dasharray="3 4"/><path d="${d}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round"/>${marks}</svg>`;
}

async function drawer(x, test) {
  const f = x.feedback || {};
  const qa = (q, a) => (a ? `<div class="qa"><div class="q">${q}</div><div>${a}</div></div>` : '');
  const timed = (notes) => Object.entries(notes || {}).map(([at, t]) => `<div class="quote"><span class="at">${fmtTime(Number(at))}</span>${esc(t)}</div>`).join('');
  const bg = document.createElement('div');
  bg.className = 'drawer-bg';
  const d = document.createElement('aside');
  d.className = 'drawer';
  d.innerHTML = `
    <div class="row between"><h2 style="margin:0">Viewer ${esc(x.id)}</h2><button class="btn-ghost" id="close" aria-label="Close">${icon('x')}</button></div>
    <p class="muted small">${WHO(x)}${x.synthetic ? ' · synthetic' : ''}${x.pid ? ` · ${esc(x.pid)}` : ''}</p>
    <div class="row" style="margin-bottom:14px"><span class="pill ${STATUS_CLASS[x.status] || 'plain'}">${STATUS[x.status] || esc(x.status)}</span>${x.valid === 1 ? '<span class="pill live plain">Counted in results</span>' : x.valid === 0 ? `<span class="pill closed plain">Not counted: ${esc(REASONS[x.excludeReason] || x.excludeReason)}</span>` : ''}</div>
    <div class="qa"><div class="q">Their journey</div>${journeyBar(x, { tall: true })}<div class="row between faint tiny" style="margin-top:4px"><span>${fmtTime(x.range.start)}</span><span>watched to ${fmtTime(x.status === 'watched' || x.status === 'completed' ? x.range.end : x.reached)}</span><span>${fmtTime(x.range.end)}</span></div></div>
    <div class="qa"><div class="q">Their attention</div><div id="att">${'<div class="skeleton" style="height:120px"></div>'}</div><p class="faint tiny" style="margin:4px 0 0">Line: looking at the screen. Green dots: spacebar. Grey dots: B (boring).</p></div>
    ${x.journey.saves.length ? qa('Saved to finish later', x.journey.saves.map((s) => `<div class="small">${fmtTime(s.at)} · ${esc(REASON_LABELS[s.reason] || s.reason)}</div>`).join('')) : ''}
    ${qa('Feeling', f.feeling ? `${FEELINGS[f.feeling - 1]} ${f.feeling} / 5` : '')}
    ${qa('Topic relevance', f.relevance ? `${f.relevance} / 5 · ${RELEVANCE_LABELS[f.relevance - 1]}` : '')}
    ${qa('Did they like it', f.liked ? `${likedOf(f.liked)?.emoji} ${likedOf(f.liked)?.label}` : '')}
    ${qa('Would recommend', f.recommend !== undefined ? `${f.recommend} / 10` : '')}
    ${qa('What grabbed them (their ✨ moments)', timed(f.momentNotes))}
    ${qa('What dragged (their 😴 moments)', timed(f.boredNotes))}
    ${qa('Lines that stood out', (x.standoutLines || []).map((c) => `<div class="quote"><span class="at">${fmtTime(c.start)}</span>“${esc(c.text)}”</div>`).join(''))}
    ${qa('Why it stood out', esc(f.standoutWhy || ''))}
    ${qa('Describe it to a friend', esc(f.oneLiner || ''))}
    ${qa('Title they would click', esc(f.titleIdea || ''))}
    ${qa('What they would cut', esc(f.wouldCut || ''))}
    ${(test.config.survey || []).map((q) => qa(esc(q.text), esc(f.custom?.[q.id] ?? ''))).join('')}
    ${!Object.keys(f).length ? `<p class="faint">${x.status === 'watched' ? 'They finished watching; their feedback is still to come.' : 'No feedback yet. Viewers answer the questions after they finish watching.'}</p>` : ''}`;
  document.body.append(bg, d);
  const close = () => {
    bg.remove();
    d.remove();
  };
  bg.onclick = close;
  d.querySelector('#close').onclick = close;
  try {
    const a = await api(`/api/tests/${test.id}/viewers/${encodeURIComponent(x.sid)}/attention`);
    d.querySelector('#att').innerHTML = attentionSvg(a.buckets, x);
  } catch {
    d.querySelector('#att').innerHTML = '<p class="faint small">Attention data is not available for this viewer.</p>';
  }
}

export async function render(el, test, vs) {
  const rows = await api(`/api/tests/${test.id}/responses?${qs(vs)}`);
  let filter = 'all';
  let q = '';
  const match = (x) =>
    (filter === 'all' || (filter === 'feedback' ? x.status === 'completed' : filter === 'waiting' ? x.status === 'watched' : filter === 'stopped' ? x.status === 'abandoned' || (x.status === 'watching' && x.journey.saves.length) : x.status === 'watching' || x.status === 'started')) &&
    (!q || JSON.stringify(x).toLowerCase().includes(q));
  const draw = () => {
    const list = rows.filter(match);
    document.getElementById('viewers').innerHTML = list.length
      ? list
          .slice(0, 300)
          .map((x) => {
            const f = x.feedback || {};
            const quote = f.standoutWhy || f.oneLiner || f.wouldCut || '';
            return `<button class="vrow" data-id="${esc(x.sid)}">
              <span class="vwho"><strong class="num">${esc(x.id)}</strong>${x.synthetic ? '<span class="faint tiny"> sim</span>' : ''}<span class="faint tiny">${WHO(x)}</span>${isAdmin() && x.pid ? `<span class="faint tiny">${esc(x.pid)}</span>` : ''}</span>
              <span class="vjourney">${journeyBar(x)}<span class="faint tiny">${x.journey.interest.length} ✨ · ${x.journey.bored.length} 😴${x.journey.saves.length ? ` · ${x.journey.saves.length} ⏸` : ''}</span></span>
              <span class="vreact" aria-label="Reaction">${f.feeling ? FEELINGS[f.feeling - 1] : ''}${f.liked ? likedOf(f.liked)?.emoji : ''}${f.recommend !== undefined ? `<span class="num small">${f.recommend}/10</span>` : ''}</span>
              <span class="vquote small">${quote ? `“${esc(quote.slice(0, 90))}${quote.length > 90 ? '…' : ''}”` : `<span class="faint">${x.status === 'watched' ? 'Feedback to come' : x.status === 'completed' ? '' : 'Still watching'}</span>`}</span>
              <span class="vstatus"><span class="pill ${STATUS_CLASS[x.status] || 'plain'}">${STATUS[x.status] || esc(x.status)}</span><span class="faint tiny">${ago(x.feedbackAt || x.lastSeen)}</span></span>
            </button>`;
          })
          .join('')
      : '<p class="faint center" style="padding:30px">No viewers match.</p>';
    for (const b of document.querySelectorAll('.vrow')) b.onclick = () => drawer(rows.find((x) => x.sid === b.dataset.id), test);
    for (const b of el.querySelectorAll('[data-f]')) b.classList.toggle('on', b.dataset.f === filter);
  };
  const count = (fn) => rows.filter(fn).length;
  el.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="tabs-pills">
          <button data-f="all">All ${rows.length}</button>
          <button data-f="feedback">Finished ${count((x) => x.status === 'completed')}</button>
          <button data-f="waiting">Feedback to come ${count((x) => x.status === 'watched')}</button>
          <button data-f="stopped">Stopped ${count((x) => x.status === 'abandoned' || (x.status === 'watching' && x.journey.saves.length))}</button>
          <button data-f="watching">Watching ${count((x) => x.status === 'watching' || x.status === 'started')}</button>
        </div>
        <input type="search" id="resp-q" placeholder="Search answers, countries…" style="max-width:260px" />
      </div>
      <div class="vlegend faint tiny"><span><i class="jm int"></i> spacebar (interesting)</span><span><i class="jm bor"></i> B (boring)</span><span><i class="jm sav"></i> saved to finish later</span><span><i class="jstop-key"></i> last watched</span></div>
      <div id="viewers" class="viewers"></div>
      ${rows.length > 300 ? '<p class="faint tiny">Showing the latest 300. Use search to find others.</p>' : ''}
    </div>`;
  for (const b of el.querySelectorAll('[data-f]')) b.onclick = () => ((filter = b.dataset.f), draw());
  document.getElementById('resp-q').oninput = (e) => ((q = e.target.value.toLowerCase()), draw());
  draw();
}
