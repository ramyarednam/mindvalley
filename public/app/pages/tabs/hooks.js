import { copyText, esc, fmtTime, icon, pct } from '/shared/ui.js';
import { api } from '/app/app.js';
import { qs } from '/app/pages/test.js';
import { quoteList, wireSeek } from '/app/pages/tabs/feedback.js';

function words(texts) {
  const stop = new Set('a an and are as at be but by for from has have i in is it its of on or so that the this to was we with you your my me about how what why when who will can do not just'.split(' '));
  const counts = new Map();
  for (const t of texts) for (const w of new Set(t.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [])) if (!stop.has(w) && !w.startsWith('[')) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
}

export async function render(el, test, vs) {
  const [fb, s] = await Promise.all([api(`/api/tests/${test.id}/feedback?${qs(vs)}`), api(`/api/tests/${test.id}/summary?${qs(vs)}`)]);
  const sum = s.ai?.content ?? s.auto;
  const titleWords = words([...fb.titleIdeas, ...fb.oneLiners].map((q) => q.text));

  el.innerHTML = `
    <div class="stack">
      <div class="card">
        <div class="card-head"><div><h2>🎣 Lines viewers say stood out</h2><p class="muted small" style="margin:0">After watching, viewers picked up to 5 transcript lines that stuck with them. Your strongest cold opens, shorts and thumbnail text.</p></div></div>
        ${
          fb.standoutLines.length
            ? fb.standoutLines
                .map(
                  (l) => `<div class="hook"><a href="#" class="hook-ts" data-seek="${l.start}">${icon('play', 12)} ${fmtTime(l.start)}</a>
                    <div><div class="hook-text">“${esc(l.text)}”</div><div class="hook-why">Picked by ${l.count} viewer${l.count === 1 ? '' : 's'} (${pct(l.share)} of those who chose lines)</div></div>
                    <div class="share-bar"><div class="meter"><span style="width:${Math.round(l.share * 100)}%"></span></div></div></div>`,
                )
                .join('')
            : `<p class="faint">${test.transcriptLines ? 'No lines picked yet.' : 'Upload a transcript (Manage tab) so viewers can pick the lines that stood out.'}</p>`
        }
      </div>
      <div class="two">
        <div class="card">
          <div class="card-head"><h3>${icon('sparkles', 16)} Hook ideas ${s.ai ? '<span class="ai-tag">Claude</span>' : ''}</h3></div>
          <div class="quotes">${(sum.hookCandidates || []).map((h) => `<div class="quote"><a href="#" class="at" data-seek="${h.timestamp}">${fmtTime(h.timestamp)}</a>${h.quote ? `“${esc(h.quote)}”` : '<strong>Spacebar peak</strong>'}<div class="who">${esc(h.why)}</div></div>`).join('') || '<p class="faint small">Not enough data yet.</p>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('type', 16)} Title ideas ${s.ai ? '<span class="ai-tag">Claude</span>' : ''}</h3></div>
          ${(sum.titleIdeas || []).map((t) => `<div class="title-idea"><span>${esc(t)}</span><button class="btn-ghost btn-sm" data-copy="${esc(t)}" aria-label="Copy">${icon('copy', 15)}</button></div>`).join('') || '<p class="faint small">Not enough data yet.</p>'}
          ${sum.thumbnailIdeas?.length ? `<h3 style="margin-top:18px">🖼️ Thumbnail text</h3>${sum.thumbnailIdeas.map((t) => `<div class="title-idea"><span>${esc(t)}</span><button class="btn-ghost btn-sm" data-copy="${esc(t)}" aria-label="Copy">${icon('copy', 15)}</button></div>`).join('')}` : ''}
          ${!s.ai && s.aiAvailable ? `<p class="faint tiny">Write an AI summary on the Summary tab for Claude's packaging ideas.</p>` : ''}
        </div>
      </div>
      <div class="pair">
        <div class="card"><div class="card-head"><h3>📝 Titles viewers would click</h3><span class="faint small">${fb.titleIdeas.length}</span></div>${quoteList(fb.titleIdeas)}</div>
        <div class="card"><div class="card-head"><h3>🗣️ "Describe it to a friend"</h3><span class="faint small">${fb.oneLiners.length}</span></div>${quoteList(fb.oneLiners)}</div>
      </div>
      ${titleWords.length ? `<div class="card"><h3>Words viewers use about it</h3><p class="muted small">From their titles and one-line descriptions. Their language is your packaging language.</p><div class="words">${titleWords.map(([w, n]) => `<span class="word" style="font-size:${0.8 + Math.min(0.6, n / Math.max(1, titleWords[0][1]) * 0.6)}rem">${esc(w)} <span class="faint">${n}</span></span>`).join('')}</div></div>` : ''}
    </div>`;
  wireSeek(el, test);
  for (const b of el.querySelectorAll('[data-copy]')) b.onclick = () => copyText(b.dataset.copy);
}
