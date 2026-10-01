import { esc, icon, toast } from '/shared/ui.js';
import { api, go } from '/app/app.js';

const STEPS = ['Video', 'Details', 'Audience', 'Questions'];

function toSec(v) {
  if (!v) return undefined;
  const parts = String(v).trim().split(':').map(Number);
  return parts.some((n) => !Number.isFinite(n)) ? undefined : parts.reduce((a, n) => a * 60 + n, 0);
}

function parseQuota(text) {
  const out = {};
  for (const line of text.split(/\n|,/)) {
    const m = line.match(/^\s*([^:=]+?)\s*[:=]\s*([\d.]+)\s*%?\s*$/);
    if (m) out[m[1]] = Number(m[2]) > 1 ? Number(m[2]) / 100 : Number(m[2]);
  }
  return out;
}

const cutRow = (i, url = '') => `<div class="cut-row" data-cut>
  <div class="field" style="margin:0"><label>Label</label><input type="text" name="label" value="${i === 0 ? 'Main cut' : `Cut ${String.fromCharCode(65 + i)}`}" /></div>
  <div class="field" style="margin:0"><label>Dropbox Replay link</label><input type="url" name="url" placeholder="https://replay.dropbox.com/share/…" value="${esc(url)}" /></div>
  <button type="button" class="btn-ghost" data-rm aria-label="Remove">${icon('x', 16)}</button>
</div>`;

export function render(view) {
  let step = 0;
  view.innerHTML = `
    <div class="page-head"><div><h1>New screening</h1><p class="muted">Four quick steps. You can change everything later.</p></div></div>
    <div class="wizard-steps">${STEPS.map((s, i) => `<span class="wstep" data-w="${i}"><span class="n">${i + 1}</span>${s}</span>`).join('')}</div>
    <form id="wiz" class="card rise" style="max-width:860px">
      <section data-step="0">
        <h2>🎬 Which video?</h2>
        <p class="muted">Paste a Dropbox Replay share link. We read the title, length and quality automatically. Add a second cut to compare two edits with a balanced audience.</p>
        <div id="cuts">${cutRow(0, 'https://replay.dropbox.com/share/qxsXZ0hahSv4hgSx')}</div>
        <button type="button" class="btn btn-sm" id="add-cut">${icon('plus', 14)} Add another cut</button>
        <details style="margin-top:16px"><summary class="muted small" style="cursor:pointer">Using a direct .m3u8 or .mp4 link instead?</summary>
          <div class="grid-2" style="margin-top:10px"><div class="field"><label for="w-dur">Length (h:mm:ss)</label><input id="w-dur" type="text" placeholder="1:35:45" /></div><div class="field"><label for="w-fps">Frame rate</label><input id="w-fps" type="number" placeholder="25" /></div></div></details>
      </section>
      <section data-step="1" class="hidden">
        <h2>✍️ Tell viewers what they're watching</h2>
        <div class="field"><label for="w-title">Episode title</label><input id="w-title" type="text" placeholder="The Extraordinary Mind: Ben Greenfield" /></div>
        <div class="field"><label for="w-desc">Short description <span class="hint">shown on the viewer's welcome screen</span></label><textarea id="w-desc" placeholder="A conversation about the habits that actually move the needle on health and longevity."></textarea></div>
        <div class="field"><label for="w-transcript">Transcript <span class="hint">SRT or VTT. Lets viewers pick the lines that stood out</span></label><input id="w-transcript" type="file" accept=".srt,.vtt,text/vtt" /></div>
        <div class="grid-2"><div class="field"><label for="w-start">Only show from <span class="hint">optional</span></label><input id="w-start" type="text" placeholder="0:00" /></div><div class="field"><label for="w-end">…to</label><input id="w-end" type="text" placeholder="15:00" /></div></div>
      </section>
      <section data-step="2" class="hidden">
        <h2>👥 Who should watch?</h2>
        <div class="grid-2">
          <div class="field"><label for="w-n">How many viewers</label><input id="w-n" type="number" min="1" value="1000" /></div>
          <div class="field"><label for="w-checks">Attention checks during the episode</label><input id="w-checks" type="number" min="0" max="10" value="3" /></div>
        </div>
        <p class="muted small">Quotas are optional. One per line, for example <code>25-34: 30%</code>. Leave blank to accept everyone.</p>
        <div class="grid-2">
          <div class="field"><label for="w-q-age">Age</label><textarea id="w-q-age" placeholder="18-24: 15%&#10;25-34: 30%&#10;35-44: 30%&#10;45-54: 15%&#10;55+: 10%"></textarea></div>
          <div class="field"><label for="w-q-country">Country <span class="hint">US, UK, IN, AU, CA, DE, MY, other</span></label><textarea id="w-q-country" placeholder="US: 40%&#10;UK: 20%&#10;other: 40%"></textarea></div>
          <div class="field"><label for="w-q-gender">Gender <span class="hint">female, male, other</span></label><textarea id="w-q-gender"></textarea></div>
          <div class="field"><label for="w-q-member">Members <span class="hint">member, non-member</span></label><textarea id="w-q-member" placeholder="member: 30%&#10;non-member: 70%"></textarea></div>
        </div>
        <div class="field"><label for="w-redirect">Panel vendor completion link <span class="hint">optional; {code} and {pid} are filled in</span></label><input id="w-redirect" type="url" placeholder="https://app.prolific.com/submissions/complete?cc={code}" /></div>
      </section>
      <section data-step="3" class="hidden">
        <h2>💬 Feedback questions</h2>
        <p class="muted">Every viewer already gets the fun built-in flow: how it made them feel, topic relevance, did they like it, their marked moments, standout transcript lines, a one-line pitch, a title they'd click, what they'd cut, and would they recommend it.</p>
        <p class="muted">Add up to 5 extra questions of your own:</p>
        <div id="qs"></div>
        <button type="button" class="btn btn-sm" id="add-q">${icon('plus', 14)} Add a question</button>
      </section>
      <p id="w-err" class="error hidden" style="margin-top:14px"></p>
      <div class="row between" style="margin-top:24px"><button type="button" class="btn-ghost" id="w-back">${icon('arrowLeft', 15)} Back</button><button type="button" class="btn-primary btn-lg" id="w-next">Next ${icon('arrowRight', 15)}</button></div>
    </form>`;

  const sections = [...view.querySelectorAll('[data-step]')];
  const show = () => {
    sections.forEach((s, i) => s.classList.toggle('hidden', i !== step));
    for (const w of view.querySelectorAll('[data-w]')) {
      const i = Number(w.dataset.w);
      w.classList.toggle('on', i === step);
      w.classList.toggle('done', i < step);
    }
    document.getElementById('w-back').style.visibility = step ? 'visible' : 'hidden';
    document.getElementById('w-next').innerHTML = step === STEPS.length - 1 ? `${icon('check', 15)} Create screening` : `Next ${icon('arrowRight', 15)}`;
  };
  const err = (m) => {
    const el = document.getElementById('w-err');
    el.textContent = m || '';
    el.classList.toggle('hidden', !m);
  };

  const cuts = document.getElementById('cuts');
  const qs = document.getElementById('qs');
  view.addEventListener('click', (e) => e.target.closest('[data-rm]')?.parentElement.remove());
  document.getElementById('add-cut').onclick = () => cuts.children.length < 4 && cuts.insertAdjacentHTML('beforeend', cutRow(cuts.children.length));
  document.getElementById('add-q').onclick = () =>
    qs.children.length < 5 && qs.insertAdjacentHTML('beforeend', `<div class="survey-row" data-q><input type="text" placeholder="e.g. Would you watch a part two?" /><select><option value="yesno">Yes / no</option><option value="scale">1 to 10</option><option value="text">Free text</option></select><button type="button" class="btn-ghost" data-rm aria-label="Remove">${icon('x', 15)}</button></div>`);

  document.getElementById('w-back').onclick = () => {
    step = Math.max(0, step - 1);
    err();
    show();
  };
  document.getElementById('w-next').onclick = async () => {
    err();
    if (step === 0 && ![...cuts.querySelectorAll('[name=url]')].some((i) => i.value.trim())) return err('Paste at least one video link.');
    if (step === 1 && !document.getElementById('w-title').value.trim()) return err('Give the screening a title.');
    if (step < STEPS.length - 1) {
      step++;
      return show();
    }
    const btn = document.getElementById('w-next');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Fetching the video…';
    try {
      const file = document.getElementById('w-transcript').files[0];
      const start = toSec(document.getElementById('w-start').value);
      const end = toSec(document.getElementById('w-end').value);
      const val = (id) => document.getElementById(id).value;
      const test = await api('/api/tests', {
        method: 'POST',
        body: {
          title: val('w-title'),
          description: val('w-desc'),
          transcript: file ? await file.text() : undefined,
          cuts: [...cuts.querySelectorAll('[data-cut]')].filter((r) => r.querySelector('[name=url]').value.trim()).map((r) => ({ label: r.querySelector('[name=label]').value, url: r.querySelector('[name=url]').value.trim(), durationSec: toSec(val('w-dur')), fps: Number(val('w-fps')) || undefined })),
          config: {
            targetViewers: Number(val('w-n')),
            attentionChecks: Number(val('w-checks')),
            completionRedirect: val('w-redirect') || undefined,
            range: end ? { start: start || 0, end } : undefined,
            quotas: { age_band: parseQuota(val('w-q-age')), country: parseQuota(val('w-q-country')), gender: parseQuota(val('w-q-gender')), member: parseQuota(val('w-q-member')) },
            survey: [...qs.querySelectorAll('[data-q]')].map((r, i) => ({ id: `q${i + 1}`, text: r.querySelector('input').value, kind: r.querySelector('select').value })),
          },
        },
      });
      toast('Screening created');
      go(`#/test/${test.id}/manage`);
    } catch (ex) {
      err(ex.message);
      btn.disabled = false;
      btn.innerHTML = `${icon('check', 15)} Create screening`;
    }
  };
  show();
}
