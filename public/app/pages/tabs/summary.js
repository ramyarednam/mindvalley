import { ago, esc, fmtTime, icon, pct, ring, sparkline, toast } from '/shared/ui.js';
import { api } from '/app/app.js';
import { qs } from '/app/pages/test.js';

const VERDICT = { strong: ['🚀', 'strong'], mixed: ['🤔', 'mixed'], weak: ['🛠️', 'weak'] };

function list(items, cls = '') {
  return items?.length ? `<ul class="findings ${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="faint small">Nothing yet.</p>';
}

function metric(value, title, sub, color) {
  return `<div class="card tight metric-ring">${ring(value, { size: 76, stroke: 8, color })}<div><div class="k">${title}</div><div class="s">${sub}</div></div></div>`;
}

export async function render(el, test, vs) {
  const [s, r, fb] = await Promise.all([api(`/api/tests/${test.id}/summary?${qs(vs)}`), api(`/api/tests/${test.id}/report?${qs(vs)}`), api(`/api/tests/${test.id}/feedback?${qs(vs)}`)]);
  const useAi = !!s.ai;
  const sum = useAi ? s.ai.content : s.auto;
  const [emoji, cls] = VERDICT[sum.verdict] || VERDICT.mixed;

  if (!r.panel.valid && !fb.responses) {
    el.innerHTML = `<div class="card empty"><div class="big">🍿</div><h2>No viewers yet</h2><p class="muted">Once people watch, their attention and feedback appear here. Admins can add synthetic viewers from the Manage tab to try it out.</p></div>`;
    return;
  }

  const aiButton = s.aiAvailable
    ? `<button id="gen-ai" class="${useAi ? 'btn' : 'btn-grad'} btn-sm">${icon('sparkles', 16)} ${useAi ? 'Refresh AI summary' : 'Write AI summary'}</button>`
    : `<span class="faint tiny" title="Set ANTHROPIC_API_KEY on the server to enable">AI summary needs an Anthropic API key on the server</span>`;

  el.innerHTML = `
    <div class="stack">
      <div class="card rise">
        <div class="row between" style="align-items:flex-start">
          <div class="verdict grow"><div class="verdict-badge ${cls}">${emoji}</div><div>
            <span class="ai-tag">${useAi ? `${icon('sparkles', 13)} Written by Claude · ${ago(s.ai.created_at)}` : 'Automatic summary'}</span>
            <h2 style="margin-top:8px">${esc(sum.headline)}</h2>
            <p class="muted small" style="margin:0">Based on ${r.panel.valid.toLocaleString()} viewers and ${fb.responses.toLocaleString()} feedback responses${useAi && s.ai.stale ? ` · <strong>${s.responses - s.ai.responses} new responses since this was written</strong>` : ''}.</p>
          </div></div>
          ${aiButton}
        </div>
      </div>

      <div class="metrics">
        ${metric(r.summary.retentionAt30s, 'Hooked at 30 s', 'still watching after the opening', 'var(--good)')}
        ${metric(r.summary.avgAttention, 'Average attention', 'looking at the screen', 'var(--primary)')}
        ${metric(r.summary.retentionAtEnd, 'Watched to the end', 'of valid viewers', 'var(--line-3)')}
        ${metric(fb.liked.likedShare, 'Liked it', `${fb.liked.n} answers`, 'var(--line-4)')}
        ${metric(fb.relevance.relevantShare, 'Topic relevant', 'rated 4 or 5 out of 5', 'var(--line-2)')}
        <div class="card tight metric-ring"><div class="big-num">${fb.recommend.nps === null ? '–' : `${fb.recommend.nps > 0 ? '+' : ''}${fb.recommend.nps}`}</div><div><div class="k">Recommend score</div><div class="s">NPS from ${fb.recommend.n} answers</div></div></div>
      </div>

      <div class="cols3">
        <div class="card"><div class="card-head"><h3>${icon('zap', 16)} Key findings</h3></div>${list(sum.keyFindings)}</div>
        <div class="card"><div class="card-head"><h3>💚 What worked</h3></div>${list(sum.whatWorked, 'good')}</div>
        <div class="card"><div class="card-head"><h3>✂️ What to fix</h3></div>${list(sum.whatToFix, 'bad')}</div>
      </div>

      <div class="two">
        <div class="card">
          <div class="card-head"><h3>Attention at a glance</h3><a class="btn btn-sm" href="#/test/${esc(test.id)}/attention">Open timeline ${icon('arrowRight', 14)}</a></div>
          ${sparkline(r.curve.attention, { height: 90 })}
          <div class="row between faint tiny"><span>${fmtTime(r.range.start)}</span><span>${fmtTime(r.range.end)}</span></div>
          <div class="row" style="margin-top:12px;gap:8px">${r.peaks.slice(0, 3).map((p) => `<span class="pill live plain">▲ ${fmtTime(p.start)}</span>`).join('')}${r.dropoffs.slice(0, 3).map((d) => `<span class="pill closed plain">▼ ${fmtTime(d.start)}</span>`).join('')}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>🎣 Hook candidates</h3><a class="btn btn-sm" href="#/test/${esc(test.id)}/hooks">All hooks ${icon('arrowRight', 14)}</a></div>
          <div class="quotes">${(sum.hookCandidates || []).slice(0, 3).map((h) => `<div class="quote"><span class="at">${fmtTime(h.timestamp)}</span>${h.quote ? `“${esc(h.quote)}”` : '<strong>Spacebar peak</strong>'}<div class="who">${esc(h.why)}</div></div>`).join('') || '<p class="faint small">No standout lines yet.</p>'}</div>
        </div>
      </div>
      ${sum.audienceNotes ? `<div class="card"><h3>${icon('globe', 16)} Audience</h3><p class="muted" style="margin:0">${esc(sum.audienceNotes)}</p></div>` : ''}
    </div>`;

  document.getElementById('gen-ai')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    b.innerHTML = '<span class="spinner"></span> Claude is reading the feedback…';
    try {
      await api(`/api/tests/${test.id}/summary?${qs(vs)}`, { method: 'POST' });
      toast('Summary ready');
      render(el, test, vs);
    } catch (err) {
      toast(err.message);
      b.disabled = false;
      b.innerHTML = `${icon('sparkles', 16)} Try again`;
    }
  });
}
