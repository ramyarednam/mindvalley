import { columns, esc, fmtTime, hbars, FEELINGS, LIKED, RELEVANCE_LABELS, pct } from '/shared/ui.js';
import { api } from '/app/app.js';
import { qs } from '/app/pages/test.js';

const WHO = (w) => [w.age_band, w.gender, w.country, w.member].filter(Boolean).map(esc).join(' · ');

export function quoteList(list, { empty = 'No answers yet.', limit = 60 } = {}) {
  if (!list.length) return `<p class="faint small">${empty}</p>`;
  return `<div class="quotes">${list
    .slice(0, limit)
    .map((q) => `<div class="quote">${q.at !== undefined ? `<a class="at" href="#" data-seek="${q.at}">${fmtTime(q.at)}</a>` : ''}${esc(q.text)}<div class="who">${WHO(q.who)}</div></div>`)
    .join('')}</div>${list.length > limit ? `<p class="faint tiny" style="margin-top:8px">Showing ${limit} of ${list.length}. See every answer in Responses.</p>` : ''}`;
}

export function wireSeek(el, test) {
  for (const a of el.querySelectorAll('[data-seek]')) {
    a.onclick = (e) => {
      e.preventDefault();
      sessionStorage.setItem('pw:seek', a.dataset.seek);
      location.hash = `#/test/${test.id}/attention`;
    };
  }
}

export async function render(el, test, vs) {
  const fb = await api(`/api/tests/${test.id}/feedback?${qs(vs)}`);
  if (!fb.responses) {
    el.innerHTML = `<div class="card empty"><div class="big">💬</div><h2>No feedback yet</h2><p class="muted">Viewers answer a short, fun questionnaire after watching. Their answers appear here.</p></div>`;
    return;
  }
  const likedItems = LIKED.map((l) => ({ label: `${l.emoji} ${l.label}`, value: fb.liked.counts[l.key], sub: pct(fb.liked.n ? fb.liked.counts[l.key] / fb.liked.n : 0) }));
  el.innerHTML = `
    <div class="stack">
      <div class="pair">
        <div class="card"><div class="card-head"><h3>How it made them feel</h3><span class="big-num">${fb.feeling.mean?.toFixed(1) ?? '–'}<span class="faint small"> / 5</span></span></div>
          ${columns(fb.feeling.distribution, FEELINGS, { color: 'var(--primary)' })}</div>
        <div class="card"><div class="card-head"><h3>Is the topic relevant to them?</h3><span class="big-num">${pct(fb.relevance.relevantShare)}</span></div>
          ${columns(fb.relevance.distribution, RELEVANCE_LABELS.map((_, i) => String(i + 1)), { color: 'var(--line-2)' })}
          <p class="faint tiny center" style="margin:6px 0 0">1 = not at all · 5 = extremely</p></div>
        <div class="card"><div class="card-head"><h3>Did they like it?</h3><span class="big-num">${pct(fb.liked.likedShare)}</span></div>${hbars(likedItems, { color: 'var(--line-4)' })}</div>
        <div class="card"><div class="card-head"><h3>Would they recommend it?</h3><span class="big-num">${fb.recommend.nps === null ? '–' : `${fb.recommend.nps > 0 ? '+' : ''}${fb.recommend.nps}`}</span></div>
          ${columns(fb.recommend.distribution, Array.from({ length: 11 }, (_, i) => String(i)), { color: 'var(--good)', height: 70, cls: 'tight' })}
          <p class="faint tiny center" style="margin:6px 0 0">NPS = % who chose 9–10 minus % who chose 0–6</p></div>
      </div>
      <div class="pair">
        <div class="card"><div class="card-head"><h3>✨ Why it stood out</h3><span class="faint small">${fb.standoutWhy.length}</span></div>${quoteList(fb.standoutWhy)}</div>
        <div class="card"><div class="card-head"><h3>📍 Notes on their marked moments</h3><span class="faint small">${fb.momentNotes.length}</span></div>${quoteList(fb.momentNotes, { empty: 'No notes on marked moments yet.' })}</div>
        <div class="card"><div class="card-head"><h3>✂️ What they'd cut</h3><span class="faint small">${fb.wouldCut.length}</span></div>${quoteList(fb.wouldCut)}</div>
        <div class="card"><div class="card-head"><h3>🗣️ How they'd describe it</h3><span class="faint small">${fb.oneLiners.length}</span></div>${quoteList(fb.oneLiners)}</div>
      </div>
      ${fb.custom.length ? `<div class="card"><h3>Your extra questions</h3><div class="grid-2" style="margin-top:12px">${fb.custom
        .map((q) =>
          q.kind === 'text'
            ? `<div><strong>${esc(q.text)}</strong>${quoteList(q.responses.map((t) => ({ text: t, who: {} })))}</div>`
            : q.kind === 'yesno'
              ? `<div><strong>${esc(q.text)}</strong><p class="big-num" style="margin-top:8px">${pct(q.yesShare)}</p><p class="faint small">said yes, of ${q.n}</p></div>`
              : `<div><strong>${esc(q.text)}</strong><p class="faint small">Average ${q.mean?.toFixed(1) ?? '–'} of ${q.n}</p>${columns(q.distribution, Array.from({ length: 10 }, (_, i) => String(i + 1)), { height: 60 })}</div>`,
        )
        .join('')}</div></div>` : ''}
    </div>`;
  wireSeek(el, test);
}
