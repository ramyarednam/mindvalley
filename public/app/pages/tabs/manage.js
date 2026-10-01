import { copyText, esc, icon, toast } from '/shared/ui.js';
import { api, go } from '/app/app.js';

const STATUSES = [
  { key: 'draft', emoji: '📝', label: 'Draft', text: 'Only your team can preview it.' },
  { key: 'live', emoji: '🟢', label: 'Live', text: 'Anyone with the panel link can join.' },
  { key: 'closed', emoji: '🔒', label: 'Closed', text: 'No new viewers. Late feedback still counts.' },
];

export async function render(el, test, _vs, rerender) {
  const link = `${location.origin}${test.panelLink}?pid={PARTICIPANT_ID}`;
  const survey = test.config.survey || [];
  el.innerHTML = `
    <div class="stack">
      <div class="card">
        <h3>Status</h3>
        <div class="grid-3" style="margin-top:12px">${STATUSES.map((s) => `<button class="card tight ${test.status === s.key ? 'on-status' : ''}" data-status="${s.key}" style="flex-direction:column;align-items:flex-start;white-space:normal;text-align:left;border-radius:16px;${test.status === s.key ? 'border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)' : ''}"><span style="font-size:1.5rem">${s.emoji}</span><strong>${s.label}</strong><span class="muted small" style="font-weight:400">${s.text}</span></button>`).join('')}</div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>${icon('link', 16)} Panel link</h3>
          <p class="muted small">Send this to your panel vendor or community. Replace <code>{PARTICIPANT_ID}</code> with each viewer's ID so they can resume on any device.</p>
          <div class="link-box"><input type="text" readonly value="${esc(link)}" /><button class="btn-primary" id="copy-link">${icon('copy', 15)} Copy</button></div>
          <p style="margin-top:12px"><a class="btn btn-sm" href="${esc(test.panelLink)}?pid=preview-${Date.now().toString(36)}" target="_blank" rel="noopener">${icon('eye', 15)} Preview as a viewer</a></p>
        </div>
        <div class="card">
          <h3>🧪 Synthetic viewers</h3>
          <p class="muted small">Fill the dashboards with simulated viewers to try the workflow. They are always labelled and can be removed.</p>
          <div class="row"><input type="number" id="sim-n" value="300" min="1" max="2000" style="width:110px" /><button class="btn" id="sim">Add</button>${test.stats.synthetic ? `<button class="btn btn-danger" id="sim-del">Remove ${test.stats.synthetic}</button>` : ''}</div>
          <p id="sim-msg" class="faint small"></p>
        </div>
      </div>
      <form class="card" id="details">
        <h3>Details</h3>
        <div class="field"><label for="m-title">Title</label><input id="m-title" type="text" value="${esc(test.title)}" required /></div>
        <div class="field"><label for="m-desc">Short description <span class="hint">shown to viewers on the welcome screen</span></label><textarea id="m-desc" maxlength="2000">${esc(test.description)}</textarea></div>
        <div class="grid-2">
          <div class="field"><label for="m-target">Target viewers</label><input id="m-target" type="number" min="1" value="${test.config.targetViewers}" /></div>
          <div class="field"><label for="m-redirect">Completion redirect <span class="hint">optional, for panel vendors</span></label><input id="m-redirect" type="url" value="${esc(test.config.completionRedirect || '')}" placeholder="https://…?code={code}" /></div>
        </div>
        <div class="field"><label>Extra questions <span class="hint">added after the built-in feedback flow, up to 5</span></label><div id="qs">${survey.map((q) => qRow(q)).join('')}</div><button type="button" class="btn btn-sm" id="add-q">${icon('plus', 14)} Add question</button></div>
        <button class="btn-primary" type="submit">Save changes</button>
      </form>
      <div class="card">
        <h3>${icon('upload', 16)} Transcript</h3>
        <p class="muted small">${test.transcriptLines ? `${test.transcriptLines} lines loaded.` : 'No transcript yet.'} Viewers pick standout lines from it, and the peaks and drop-offs show what was said. Upload an SRT or VTT file (Premiere, Descript and YouTube all export these).</p>
        <input type="file" id="m-transcript" accept=".srt,.vtt,text/vtt" />
      </div>
      <div class="card" style="border-color:var(--bad-soft)">
        <h3 style="color:var(--bad)">Danger zone</h3>
        <p class="muted small">Deleting removes the screening and every viewer's data. This cannot be undone.</p>
        <button class="btn btn-danger" id="delete">${icon('trash', 15)} Delete screening</button>
      </div>
    </div>`;

  for (const b of el.querySelectorAll('[data-status]')) {
    b.onclick = async () => {
      await api(`/api/tests/${test.id}`, { method: 'PATCH', body: { status: b.dataset.status } });
      toast(`Screening is now ${b.dataset.status}`);
      rerender();
    };
  }
  document.getElementById('copy-link').onclick = () => copyText(link);
  document.getElementById('sim').onclick = async (e) => {
    e.target.disabled = true;
    document.getElementById('sim-msg').textContent = 'Simulating… a long episode takes a few seconds per 100 viewers.';
    const out = await api(`/api/tests/${test.id}/simulate`, { method: 'POST', body: { viewers: Number(document.getElementById('sim-n').value) } });
    toast(`Added ${out.created} synthetic viewers`);
    rerender();
  };
  document.getElementById('sim-del')?.addEventListener('click', async () => {
    await api(`/api/tests/${test.id}/synthetic`, { method: 'DELETE' });
    toast('Synthetic viewers removed');
    rerender();
  });
  const qs = document.getElementById('qs');
  el.addEventListener('click', (e) => e.target.closest('[data-rm]')?.parentElement.remove());
  document.getElementById('add-q').onclick = () => qs.children.length < 5 && qs.insertAdjacentHTML('beforeend', qRow());
  document.getElementById('details').onsubmit = async (e) => {
    e.preventDefault();
    const survey = [...qs.querySelectorAll('[data-q]')].map((row, i) => ({ id: row.dataset.id || `q${i + 1}`, text: row.querySelector('input').value, kind: row.querySelector('select').value }));
    await api(`/api/tests/${test.id}`, {
      method: 'PATCH',
      body: { title: document.getElementById('m-title').value, description: document.getElementById('m-desc').value, config: { targetViewers: Number(document.getElementById('m-target').value), completionRedirect: document.getElementById('m-redirect').value, survey } },
    });
    toast('Saved');
    rerender();
  };
  document.getElementById('m-transcript').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const out = await api(`/api/tests/${test.id}`, { method: 'PATCH', body: { transcript: await file.text() } });
    toast(out.transcriptLines ? `${out.transcriptLines} transcript lines loaded` : 'No lines found in that file');
    rerender();
  };
  document.getElementById('delete').onclick = async () => {
    if (!confirm(`Delete "${test.title}" and all its viewer data? This cannot be undone.`)) return;
    await api(`/api/tests/${test.id}`, { method: 'DELETE' });
    toast('Deleted');
    go('#/');
  };
}

function qRow(q = { text: '', kind: 'scale' }) {
  return `<div class="survey-row" data-q data-id="${esc(q.id || '')}"><input type="text" value="${esc(q.text)}" placeholder="Your question" /><select>${[['scale', '1 to 10'], ['yesno', 'Yes / no'], ['text', 'Free text']].map(([k, l]) => `<option value="${k}" ${q.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select><button type="button" class="btn-ghost" data-rm aria-label="Remove">${icon('x', 15)}</button></div>`;
}
