import { esc, fmtDuration, icon } from '/shared/ui.js';
import { api, isAdmin } from '/app/app.js';

// A fixed list (not a computed path) so bundlers and the preview build can follow every tab.
const TAB_MODULES = {
  summary: () => import('/app/pages/tabs/summary.js'),
  attention: () => import('/app/pages/tabs/attention.js'),
  feedback: () => import('/app/pages/tabs/feedback.js'),
  hooks: () => import('/app/pages/tabs/hooks.js'),
  audience: () => import('/app/pages/tabs/audience.js'),
  responses: () => import('/app/pages/tabs/responses.js'),
  manage: () => import('/app/pages/tabs/manage.js'),
};

const TABS = [
  { key: 'summary', label: 'Summary', ic: 'sparkles' },
  { key: 'attention', label: 'Attention', ic: 'chart' },
  { key: 'feedback', label: 'Feedback', ic: 'message' },
  { key: 'hooks', label: 'Hooks & packaging', ic: 'zap' },
  { key: 'audience', label: 'Audience', ic: 'globe' },
  { key: 'responses', label: 'Responses', ic: 'list' },
  { key: 'manage', label: 'Manage', ic: 'settings', admin: true },
];

/** View state shared by every tab: which cut and whether synthetic viewers are included. */
export function viewState(test) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(`pw:view:${test.id}`) || '{}');
  } catch {
    // Storage blocked: use defaults.
  }
  const cut = test.cuts.find((c) => c.id === saved.cut)?.id ?? test.cuts[0]?.id;
  return { cut, synthetic: saved.synthetic ?? true };
}

export function saveViewState(test, vs) {
  try {
    localStorage.setItem(`pw:view:${test.id}`, JSON.stringify(vs));
  } catch {
    // Not critical.
  }
}

export const qs = (vs, extra = {}) => new URLSearchParams({ cut: vs.cut, synthetic: vs.synthetic ? '1' : '0', ...extra }).toString();

export async function render(view, id, tab) {
  const test = await api(`/api/tests/${id}`);
  const tabs = TABS.filter((t) => !t.admin || isAdmin());
  if (!tabs.some((t) => t.key === tab)) tab = 'summary';
  const cut = test.cuts[0] || {};
  const vs = viewState(test);

  view.innerHTML = `
    <section class="hero">
      <div class="hero-bg" style="background-image:${cut.posterUrl ? `url('${esc(cut.posterUrl)}'), ` : ''}var(--grad)"></div>
      <div class="crumbs"><a href="#/">Dashboard</a> / Screening</div>
      <div class="hero-actions">
        ${test.cuts.length > 1 ? `<select id="cut-select" aria-label="Cut">${test.cuts.map((c) => `<option value="${esc(c.id)}" ${c.id === vs.cut ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select>` : ''}
        <a class="btn btn-sm" href="${esc(test.panelLink)}?pid=preview-${Date.now().toString(36)}" target="_blank" rel="noopener">${icon('eye', 16)} Preview as viewer</a>
      </div>
      <h1>${esc(test.title)}</h1>
      <div class="hero-meta">
        <span class="pill ${esc(test.status)}">${test.status === 'live' ? 'Live' : test.status === 'draft' ? 'Draft' : 'Closed'}</span>
        ${cut.durationSec ? `<span>${icon('clock', 15)} ${fmtDuration(cut.durationSec)}</span>` : ''}
        <span>${icon('users', 15)} ${test.stats.valid.toLocaleString()} viewers</span>
        <span>${icon('message', 15)} ${test.stats.responses.toLocaleString()} responses</span>
        ${test.stats.watching ? `<span>🟢 ${test.stats.watching} watching now</span>` : ''}
      </div>
      <nav class="tabs">${tabs.map((t) => `<a href="#/test/${esc(id)}/${t.key}" class="${t.key === tab ? 'on' : ''}">${icon(t.ic, 16)}${t.label}</a>`).join('')}</nav>
    </section>
    ${test.stats.synthetic ? `<div class="toolbar"><label class="switch"><input type="checkbox" id="syn" ${vs.synthetic ? 'checked' : ''} /> Include ${test.stats.synthetic} synthetic viewers</label>${vs.synthetic ? '<span class="pill draft plain">Showing simulated data</span>' : ''}</div>` : ''}
    <div id="tab"></div>`;

  document.getElementById('cut-select')?.addEventListener('change', (e) => {
    saveViewState(test, { ...vs, cut: e.target.value });
    render(view, id, tab);
  });
  document.getElementById('syn')?.addEventListener('change', (e) => {
    saveViewState(test, { ...vs, synthetic: e.target.checked });
    render(view, id, tab);
  });

  const el = document.getElementById('tab');
  el.innerHTML = '<div class="card skeleton" style="height:260px"></div>';
  const mod = await TAB_MODULES[tab]();
  await mod.render(el, test, vs, () => render(view, id, tab));
}
