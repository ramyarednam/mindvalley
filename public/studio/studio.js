import { TimelineChart, fmtTime } from '/studio/chart.js';

const view = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (v, d = 0) => (v === null || v === undefined ? '–' : `${(v * 100).toFixed(d)}%`);
const LINE_COLORS = ['--line-2', '--line-3', '--line-4', '--line-5', '--line-1'];
const SEGMENT_LABELS = { age_band: 'Age', gender: 'Gender', country: 'Country', member: 'Member status' };
const REASONS = {
  calibration_failed: 'Calibration failed',
  watched_too_little: 'Watched too little',
  face_not_visible: 'Face not visible',
  failed_attention_checks: 'Failed attention checks',
  suspicious_key_pattern: 'Suspicious key pattern',
};

let cleanup = [];
const onCleanup = (fn) => cleanup.push(fn);

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') {
    renderLogin();
    throw new Error('Signed out');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toSec(v) {
  if (!v) return undefined;
  const parts = String(v).trim().split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return undefined;
  return parts.reduce((a, n) => a * 60 + n, 0);
}

// ---------- routing ----------

async function route() {
  for (const fn of cleanup) fn();
  cleanup = [];
  const me = await fetch('/api/me').then((r) => r.json());
  document.getElementById('logout').classList.toggle('hidden', !me.studio);
  document.getElementById('nav-new').classList.toggle('hidden', !me.studio);
  if (!me.studio) return renderLogin();
  const [, page, id, sub] = (location.hash || '#/').slice(1).split('/');
  try {
    if (page === 'new') return renderNew();
    if (page === 'test' && sub === 'report') return await renderReport(id);
    if (page === 'test') return await renderTest(id);
    return await renderList();
  } catch (err) {
    view.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}
addEventListener('hashchange', route);
document.getElementById('logout').onclick = async () => {
  await api('/api/logout', { method: 'POST' });
  route();
};

function renderLogin() {
  view.innerHTML = document.getElementById('tpl-login').innerHTML;
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/login', { method: 'POST', body: { password: document.getElementById('pw').value } });
      route();
    } catch (err) {
      const el = document.getElementById('login-error');
      el.textContent = err.message;
      el.classList.remove('hidden');
    }
  };
}

// ---------- list ----------

async function renderList() {
  view.innerHTML = '<p class="muted">Loading…</p>';
  const tests = await api('/api/tests');
  view.innerHTML = `
    <div class="page-head"><div><h1>Tests</h1><p class="muted">Each test streams one or more cuts of an episode to a viewer panel before release.</p></div></div>
    ${tests.length ? '' : '<div class="card"><h2>No tests yet</h2><p class="muted">Create a test from a Dropbox Replay link or a direct video link.</p><a class="btn primary" href="#/new">New test</a></div>'}
    <div class="test-list">
      ${tests
        .map(
          (t) => `<a class="card test-item" href="#/test/${esc(t.id)}">
            ${t.cuts[0]?.posterUrl ? `<img src="${esc(t.cuts[0].posterUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : '<div class="thumb-empty"></div>'}
            <div><h3>${esc(t.title)}</h3><div class="meta">${t.cuts.map((c) => `${esc(c.label)} · ${fmtTime(c.durationSec || 0)}`).join(' &nbsp;|&nbsp; ')}</div>
            <div class="meta">${t.counts.valid} valid of ${t.config.targetViewers} target · ${t.counts.watching} watching now${t.counts.synthetic ? ` · ${t.counts.synthetic} synthetic` : ''}</div></div>
            <span class="pill ${esc(t.status)}">${esc(t.status)}</span>
          </a>`,
        )
        .join('')}
    </div>`;
}

// ---------- new test ----------

function cutRowHtml(i, url = '') {
  return `<div class="cut-row" data-cut>
    <div class="field"><label>Label</label><input type="text" name="label" value="Cut ${String.fromCharCode(65 + i)}" /></div>
    <div class="field"><label>Video link</label><input type="url" name="url" placeholder="https://replay.dropbox.com/share/… or https://…/video.m3u8" value="${esc(url)}" required /></div>
    <div class="field"><label>Duration <span class="hint">direct links</span></label><input type="text" name="duration" placeholder="hh:mm:ss" /></div>
    <div class="field"><label>FPS</label><input type="number" name="fps" placeholder="25" min="1" max="120" /></div>
    <button type="button" class="danger" data-remove title="Remove cut" aria-label="Remove cut">×</button>
  </div>`;
}

function surveyRowHtml(q = { text: '', kind: 'scale' }) {
  return `<div class="survey-row" data-q>
    <input type="text" name="text" value="${esc(q.text)}" placeholder="Question" />
    <select name="kind">${['scale', 'yesno', 'text'].map((k) => `<option value="${k}" ${q.kind === k ? 'selected' : ''}>${{ scale: '1 to 10', yesno: 'Yes / no', text: 'Free text' }[k]}</option>`).join('')}</select>
    <button type="button" class="danger" data-remove aria-label="Remove question">×</button>
  </div>`;
}

const DEFAULT_QUESTIONS = [
  { text: 'How much did you enjoy this episode? (1 = not at all, 10 = loved it)', kind: 'scale' },
  { text: 'Would you share this episode with a friend?', kind: 'yesno' },
  { text: 'What was the best moment, and why?', kind: 'text' },
  { text: 'Was there a moment you wanted to skip? What was it?', kind: 'text' },
];

function parseQuota(text) {
  const out = {};
  for (const line of text.split(/\n|,/)) {
    const m = line.match(/^\s*([^:=]+?)\s*[:=]\s*([\d.]+)\s*%?\s*$/);
    if (m) out[m[1]] = Number(m[2]) > 1 ? Number(m[2]) / 100 : Number(m[2]);
  }
  return out;
}

function renderNew() {
  view.innerHTML = `
    <div class="page-head"><div><h1>New test</h1><p class="muted">Paste a Dropbox Replay share link. Add a second cut to compare two edits on a balanced panel.</p></div></div>
    <form id="new-form" class="card">
      <div class="field"><label for="f-title">Episode title</label><input id="f-title" type="text" required placeholder="The Extraordinary Mind: Ben Greenfield" /></div>
      <fieldset><legend>Cuts</legend><div id="cuts">${cutRowHtml(0, 'https://replay.dropbox.com/share/qxsXZ0hahSv4hgSx')}</div>
        <button type="button" id="add-cut">Add cut</button>
        <p class="muted small">Dropbox Replay links fill in title, length and frame rate automatically. Direct .m3u8 or .mp4 links need a duration.</p></fieldset>
      <fieldset><legend>Panel</legend>
        <div class="grid-2">
          <div class="field"><label for="f-n">Target valid viewers</label><input id="f-n" type="number" min="1" value="1000" /></div>
          <div class="field"><label for="f-checks">Attention checks</label><input id="f-checks" type="number" min="0" max="10" value="3" /></div>
          <div class="field"><label for="f-watch">Minimum watched <span class="hint">% of the range</span></label><input id="f-watch" type="number" min="0" max="100" value="70" /></div>
          <div class="field"><label for="f-pause">Pause warning after <span class="hint">minutes</span></label><input id="f-pause" type="number" min="0" value="15" /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label for="f-q-age">Age quota <span class="hint">one per line, e.g. 25-34: 30%</span></label><textarea id="f-q-age" placeholder="18-24: 15%&#10;25-34: 30%&#10;35-44: 30%&#10;45-54: 15%&#10;55+: 10%"></textarea></div>
          <div class="field"><label for="f-q-country">Country quota <span class="hint">US, UK, IN, AU, CA, DE, MY, other</span></label><textarea id="f-q-country" placeholder="US: 40%&#10;UK: 20%&#10;IN: 20%&#10;other: 20%"></textarea></div>
          <div class="field"><label for="f-q-gender">Gender quota <span class="hint">female, male, other</span></label><textarea id="f-q-gender" placeholder="female: 50%&#10;male: 48%&#10;other: 2%"></textarea></div>
          <div class="field"><label for="f-q-member">Member quota <span class="hint">member, non-member</span></label><textarea id="f-q-member" placeholder="member: 30%&#10;non-member: 70%"></textarea></div>
        </div>
        <div class="field"><label for="f-redirect">Completion redirect <span class="hint">optional panel-vendor URL; {code} and {pid} are filled in</span></label><input id="f-redirect" type="url" placeholder="https://app.prolific.com/submissions/complete?cc={code}" /></div>
      </fieldset>
      <fieldset><legend>Chapter test (optional)</legend>
        <div class="grid-2"><div class="field"><label for="f-start">Start at</label><input id="f-start" type="text" placeholder="0:00" /></div><div class="field"><label for="f-end">End at</label><input id="f-end" type="text" placeholder="15:00" /></div></div>
        <p class="muted small">Show only part of each cut, for a cheaper test of a cold open or a single chapter.</p></fieldset>
      <fieldset><legend>End-of-watch survey</legend><div id="questions">${DEFAULT_QUESTIONS.map(surveyRowHtml).join('')}</div><button type="button" id="add-q">Add question</button> <span class="muted small">Up to 5.</span></fieldset>
      <fieldset><legend>Transcript (optional)</legend>
        <div class="field"><label for="f-transcript">SRT or VTT file <span class="hint">shows the words under each peak and drop-off</span></label><input id="f-transcript" type="file" accept=".srt,.vtt,text/vtt" /></div></fieldset>
      <p id="new-error" class="error hidden"></p>
      <button class="primary" type="submit" id="create">Create test</button>
    </form>`;

  const cuts = document.getElementById('cuts');
  const questions = document.getElementById('questions');
  const onRemove = (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) rm.parentElement.remove();
  };
  view.addEventListener('click', onRemove);
  onCleanup(() => view.removeEventListener('click', onRemove));
  document.getElementById('add-cut').onclick = () => {
    if (cuts.children.length < 4) cuts.insertAdjacentHTML('beforeend', cutRowHtml(cuts.children.length));
  };
  document.getElementById('add-q').onclick = () => {
    if (questions.children.length < 5) questions.insertAdjacentHTML('beforeend', surveyRowHtml());
  };
  document.getElementById('new-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById('new-error');
    err.classList.add('hidden');
    const btn = document.getElementById('create');
    btn.disabled = true;
    btn.textContent = 'Resolving video links…';
    try {
      const file = document.getElementById('f-transcript').files[0];
      const start = toSec(document.getElementById('f-start').value);
      const end = toSec(document.getElementById('f-end').value);
      const body = {
        title: document.getElementById('f-title').value,
        cuts: [...cuts.querySelectorAll('[data-cut]')].map((row) => ({
          label: row.querySelector('[name=label]').value,
          url: row.querySelector('[name=url]').value,
          durationSec: toSec(row.querySelector('[name=duration]').value),
          fps: Number(row.querySelector('[name=fps]').value) || undefined,
        })),
        config: {
          targetViewers: Number(document.getElementById('f-n').value),
          attentionChecks: Number(document.getElementById('f-checks').value),
          minWatchPct: Number(document.getElementById('f-watch').value) / 100,
          maxPauseSec: Number(document.getElementById('f-pause').value) * 60,
          completionRedirect: document.getElementById('f-redirect').value || undefined,
          range: end ? { start: start || 0, end } : undefined,
          quotas: {
            age_band: parseQuota(document.getElementById('f-q-age').value),
            country: parseQuota(document.getElementById('f-q-country').value),
            gender: parseQuota(document.getElementById('f-q-gender').value),
            member: parseQuota(document.getElementById('f-q-member').value),
          },
          survey: [...questions.querySelectorAll('[data-q]')].map((row, i) => ({ id: `q${i + 1}`, text: row.querySelector('[name=text]').value, kind: row.querySelector('[name=kind]').value })),
        },
        transcript: file ? await file.text() : undefined,
      };
      const test = await api('/api/tests', { method: 'POST', body });
      location.hash = `#/test/${test.id}`;
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Create test';
    }
  };
}

// ---------- test overview ----------

async function renderTest(id) {
  view.innerHTML = '<p class="muted">Loading…</p>';
  const draw = async () => {
    const [t, sessions] = await Promise.all([api(`/api/tests/${id}`), api(`/api/tests/${id}/sessions`)]);
    const link = `${location.origin}${t.panelLink}`;
    const recent = sessions.slice(-50).reverse();
    view.innerHTML = `
      <div class="page-head">
        <div><p class="muted small"><a href="#/">Tests</a> /</p><h1>${esc(t.title)}</h1>
          <p class="muted">${t.cuts.map((c) => `${esc(c.label)}: ${esc(c.name || '')} · ${fmtTime(c.durationSec || 0)} · ${c.width ? `${c.width}×${c.height} · ` : ''}${c.fps || 25} fps`).join('<br>')}</p></div>
        <div class="row">
          <span class="pill ${esc(t.status)}">${esc(t.status)}</span>
          <select id="status" aria-label="Status">${['draft', 'live', 'closed'].map((s) => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${s === 'live' ? 'Live: accepting viewers' : s === 'draft' ? 'Draft' : 'Closed'}</option>`).join('')}</select>
          <a class="btn primary" href="#/test/${esc(id)}/report">Open report</a>
        </div>
      </div>
      <div class="tiles">
        <div class="tile"><div class="k">Valid viewers</div><div class="v">${t.counts.valid}</div><div class="s">of ${t.config.targetViewers} target</div></div>
        <div class="tile"><div class="k">Watching now</div><div class="v">${t.counts.watching}</div><div class="s">refreshes every 15 s</div></div>
        <div class="tile"><div class="k">Completed</div><div class="v">${t.counts.completed}</div><div class="s">${t.counts.sessions} started</div></div>
        <div class="tile"><div class="k">Screened out</div><div class="v">${t.counts.screenedOut}</div><div class="s">quota full or off-target</div></div>
      </div>
      <div class="grid-2" style="margin-top:16px">
        <div class="card">
          <h2>Panel link</h2>
          <p class="muted small">${t.status === 'live' ? 'Send this to your panel vendor or community. Add <code>?pid=</code> with each viewer\'s ID so they can resume.' : 'Set the test to Live to accept viewers. You can preview it now as the studio.'}</p>
          <div class="link-box"><input type="text" readonly value="${esc(link)}?pid={PARTICIPANT_ID}" id="link" /><button id="copy">Copy</button></div>
          <p style="margin-top:10px"><a class="btn" href="${esc(t.panelLink)}?pid=studio-preview-${Date.now().toString(36)}" target="_blank" rel="noopener">Preview as a viewer</a></p>
        </div>
        <div class="card">
          <h2>Synthetic panel</h2>
          <p class="muted small">Fill the report with simulated viewers to try the workflow before real data arrives. Synthetic rows are labelled and can be deleted.</p>
          <div class="row"><input type="number" id="sim-n" value="300" min="1" max="2000" style="width:110px" /><button id="sim">Add synthetic viewers</button>${t.counts.synthetic ? `<button id="sim-del" class="danger">Delete ${t.counts.synthetic} synthetic</button>` : ''}</div>
          <p id="sim-msg" class="muted small"></p>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h2>Latest sessions</h2>
        ${recent.length ? `<table><thead><tr><th>Viewer</th><th>Cut</th><th>Status</th><th>Quality</th><th>Reached</th><th>Checks</th><th>Audience</th></tr></thead><tbody>${recent
          .map((s) => `<tr><td class="num">${esc(s.pid)}${s.synthetic ? ' <span class="pill">synthetic</span>' : ''}</td><td>${esc(t.cuts.find((c) => c.id === s.cut)?.label || '')}</td><td>${esc(s.status)}</td><td>${s.valid === 1 ? '<span class="pill live">valid</span>' : s.valid === 0 ? `<span class="pill closed">${esc(REASONS[s.excludeReason] || s.excludeReason)}</span>` : '<span class="muted">pending</span>'}</td><td class="num">${fmtTime(s.maxPt)}</td><td class="num">${esc(s.checks)}</td><td class="small muted">${[s.age_band, s.gender, s.country, s.member].filter(Boolean).map(esc).join(' · ')}</td></tr>`)
          .join('')}</tbody></table>` : '<p class="muted">No viewers yet.</p>'}
      </div>
      <p style="margin-top:24px"><button id="delete" class="danger">Delete test</button></p>`;

    document.getElementById('status').onchange = async (e) => {
      await api(`/api/tests/${id}`, { method: 'PATCH', body: { status: e.target.value } });
      draw();
    };
    document.getElementById('copy').onclick = () => navigator.clipboard?.writeText(document.getElementById('link').value);
    document.getElementById('sim').onclick = async (e) => {
      e.target.disabled = true;
      document.getElementById('sim-msg').textContent = 'Simulating… long episodes take a few seconds per 100 viewers.';
      const out = await api(`/api/tests/${id}/simulate`, { method: 'POST', body: { viewers: Number(document.getElementById('sim-n').value) } });
      document.getElementById('sim-msg').textContent = `Added ${out.created} synthetic viewers.`;
      draw();
    };
    document.getElementById('sim-del')?.addEventListener('click', async () => {
      await api(`/api/tests/${id}/synthetic`, { method: 'DELETE' });
      draw();
    });
    document.getElementById('delete').onclick = async () => {
      if (!confirm('Delete this test and all its viewer data? This cannot be undone.')) return;
      await api(`/api/tests/${id}`, { method: 'DELETE' });
      location.hash = '#/';
    };
  };
  await draw();
  const timer = setInterval(() => {
    if (!document.activeElement || document.activeElement === document.body) draw().catch(() => {});
  }, 15_000);
  onCleanup(() => clearInterval(timer));
}

// ---------- report ----------

async function renderReport(id) {
  view.innerHTML = '<p class="muted">Building report…</p>';
  const t = await api(`/api/tests/${id}`);
  const state = { cut: t.cuts[0].id, segment: '', synthetic: true, report: null, hls: null };

  view.innerHTML = `
    <div class="page-head">
      <div><p class="muted small"><a href="#/">Tests</a> / <a href="#/test/${esc(id)}">${esc(t.title)}</a> /</p><h1>Report</h1><p class="muted" id="report-lead"></p></div>
      <div class="toolbar">
        ${t.cuts.length > 1 ? `<select id="cut" aria-label="Cut">${t.cuts.map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}</select>` : ''}
        <select id="segment" aria-label="Compare audience"><option value="">All viewers</option>${Object.entries(SEGMENT_LABELS).map(([k, v]) => `<option value="${k}">By ${v.toLowerCase()}</option>`).join('')}</select>
        <select id="smooth" aria-label="Smoothing"><option value="1">No smoothing</option><option value="5">5 s smoothing</option><option value="15" selected>15 s smoothing</option><option value="60">60 s smoothing</option></select>
        <label class="row" style="font-weight:500"><input type="checkbox" id="synthetic" checked /> Include synthetic</label>
      </div>
    </div>
    <div id="synthetic-note" class="notice hidden"></div>
    <div class="tiles" id="tiles"></div>
    <div class="report-grid" style="margin-top:16px">
      <div class="stack">
        <div class="player-box"><video id="studio-player" controls playsinline></video></div>
        <div class="card chart-card">
          <canvas id="chart" aria-label="Attention, retention and interest over the episode"></canvas>
          <div id="chart-tip" class="chart-tip hidden"></div>
          <div class="legend"><span><i style="border-color:var(--accent)"></i>Attention</span><span><i class="box" style="background:var(--accent-soft)"></i>95% range</span><span><i class="dash" style="border-color:var(--text-2)"></i>Baseline</span><span><i class="dot" style="border-color:var(--text-2)"></i>Still watching</span><span><i class="box" style="background:var(--peak)"></i>Interest</span><span><i class="box" style="background:var(--drop);opacity:.3"></i>Drop-off</span><span id="seg-legend"></span></div>
          <p class="muted small" style="margin:6px 4px 0">Click to jump the player. Drag to zoom, double-click to zoom out.</p>
        </div>
      </div>
      <div class="stack">
        <div class="card"><div class="row" style="justify-content:space-between"><h2>Exports</h2></div>
          <div class="row"><a class="btn" id="exp-xml">Premiere Pro (XML)</a><a class="btn" id="exp-edl">DaVinci Resolve (EDL)</a><a class="btn" id="exp-csv">CSV</a></div>
          <p class="muted small" style="margin-top:8px">Markers for the top peaks (green) and drop-offs (red), with transcript text when one was uploaded.</p></div>
        <div class="card"><h2>Top peaks</h2><p class="muted small">Where the most viewers pressed the spacebar. Candidates for the cold open, clips and show notes.</p><table class="moments"><tbody id="peaks"></tbody></table></div>
        <div class="card"><h2>Top drop-offs</h2><p class="muted small">Stretches of 20 s or more where attention fell 10+ points below the episode's rolling baseline.</p><table class="moments"><tbody id="drops"></tbody></table></div>
      </div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="card" id="segments-card"><h2>Audience splits</h2><div id="segments"></div></div>
      <div class="card"><h2>Panel quality</h2><div id="quality"></div></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Survey</h2><div id="survey" class="grid-2"></div></div>`;

  const video = document.getElementById('studio-player');
  const chart = new TimelineChart(document.getElementById('chart'), document.getElementById('chart-tip'), {
    onSeek: (sec) => {
      video.currentTime = sec;
      chart.setPlayhead(sec);
    },
  });
  video.addEventListener('timeupdate', () => chart.setPlayhead(video.currentTime));
  onCleanup(() => state.hls?.destroy());

  async function loadStream() {
    state.hls?.destroy();
    const s = await api(`/api/tests/${id}/studio-stream?cut=${state.cut}`);
    if (s.kind === 'hls' && window.Hls?.isSupported()) {
      state.hls = new window.Hls({ capLevelToPlayerSize: true });
      state.hls.loadSource(s.src);
      state.hls.attachMedia(video);
    } else video.src = s.src;
  }

  const seekTo = (sec) => {
    video.currentTime = Math.max(0, sec);
    video.play().catch(() => {});
  };

  function momentRows(list, kind) {
    if (!list.length) return `<tr><td class="muted">None found yet.</td></tr>`;
    return list
      .map(
        (m, i) => `<tr data-seek="${m.start}"><td class="tag ${kind}">${i + 1}</td><td><strong class="num">${fmtTime(m.start)}–${fmtTime(m.end)}</strong> <span class="muted small">${kind === 'peak' ? `${m.score} presses / 100 viewers` : `${m.score} pts below baseline`} · attention ${pct(m.attention)}</span>${m.transcript ? `<div class="small">“${esc(m.transcript)}”</div>` : ''}</td></tr>`,
      )
      .join('');
  }

  async function load() {
    const q = new URLSearchParams({ cut: state.cut, synthetic: state.synthetic ? '1' : '0' });
    if (state.segment) q.set('segment', state.segment);
    const r = await api(`/api/tests/${id}/report?${q}`);
    state.report = r;
    const p = r.panel;
    document.getElementById('report-lead').textContent = `${r.cut.label}: ${r.cut.name || ''} · ${fmtTime(r.range.end - r.range.start)}${r.range.start > 0 || r.range.end < r.cut.durationSec ? ` (chapter ${fmtTime(r.range.start)}–${fmtTime(r.range.end)})` : ''}`;
    const note = document.getElementById('synthetic-note');
    note.textContent = p.synthetic ? `This report includes ${p.synthetic} synthetic viewers. Untick "Include synthetic" to see real viewers only.` : '';
    note.classList.toggle('hidden', !p.synthetic);

    document.getElementById('tiles').innerHTML = `
      <div class="tile"><div class="k">Valid viewers</div><div class="v">${p.valid}</div><div class="s">of ${r.test.targetViewers} target · ${p.inProgress} watching</div></div>
      <div class="tile"><div class="k">Average attention</div><div class="v">${pct(r.summary.avgAttention)}</div><div class="s">share looking at the screen</div></div>
      <div class="tile"><div class="k">Watching at 30 s</div><div class="v">${pct(r.summary.retentionAt30s)}</div><div class="s">of valid viewers</div></div>
      <div class="tile"><div class="k">Watching at end</div><div class="v">${pct(r.summary.retentionAtEnd)}</div><div class="s">of valid viewers</div></div>
      <div class="tile"><div class="k">Spacebar presses</div><div class="v">${r.summary.interestPresses.toLocaleString()}</div><div class="s">${p.valid ? (r.summary.interestPresses / p.valid).toFixed(1) : 0} per viewer</div></div>`;

    const overlays = [];
    const seg = r.segments.find((s) => s.key === state.segment);
    if (seg) {
      seg.options.filter((o) => !o.hidden && o.attention).forEach((o, i) => {
        const color = getComputedStyle(document.documentElement).getPropertyValue(LINE_COLORS[i % LINE_COLORS.length]).trim();
        overlays.push({ label: o.value, values: o.attention, color });
      });
    }
    document.getElementById('seg-legend').innerHTML = overlays.map((o) => `<span style="margin-right:10px"><i style="border-color:${o.color}"></i>${esc(o.label)}</span>`).join('');
    chart.setData(r, overlays);

    document.getElementById('peaks').innerHTML = momentRows(r.peaks, 'peak');
    document.getElementById('drops').innerHTML = momentRows(r.dropoffs, 'drop');
    for (const row of view.querySelectorAll('[data-seek]')) {
      row.onclick = () => {
        const s = Number(row.dataset.seek);
        seekTo(s - 3);
        chart.zoomTo(Math.max(r.curve.start, s - 120), Math.min(r.range.end, s + 180));
      };
    }

    document.getElementById('segments').innerHTML = r.segments
      .map((s) => {
        const total = s.options.reduce((a, o) => a + o.n, 0) || 1;
        return `<h3 style="margin-top:10px">${SEGMENT_LABELS[s.key]}</h3>${s.options.length ? s.options.map((o) => `<div class="dist"><span></span><div><div class="small">${esc(o.value)} <span class="muted">${o.n}${o.hidden ? ' · under minimum, hidden from charts' : ''}</span></div><div class="bar-h" style="width:${(100 * o.n) / total}%"></div></div><span class="num small">${Math.round((100 * o.n) / total)}%</span></div>`).join('') : '<p class="muted small">No data.</p>'}`;
      })
      .join('');

    const ex = Object.entries(p.excluded);
    document.getElementById('quality').innerHTML = `<table><tbody>
      <tr><td>Sessions started</td><td class="num">${p.sessions}</td></tr>
      <tr><td>Completed</td><td class="num">${p.completed}</td></tr>
      <tr><td>Watching now</td><td class="num">${p.inProgress}</td></tr>
      <tr><td>Screened out</td><td class="num">${p.screenedOut}</td></tr>
      <tr><td><strong>Valid, used in charts</strong></td><td class="num"><strong>${p.valid}</strong></td></tr>
      ${ex.map(([k, n]) => `<tr><td class="muted">Excluded: ${esc(REASONS[k] || k)}</td><td class="num">${n}</td></tr>`).join('')}
    </tbody></table>`;

    document.getElementById('survey').innerHTML = r.survey.length
      ? r.survey
          .map((q) => {
            if (q.kind === 'scale') {
              const max = Math.max(1, ...Object.values(q.distribution || {}));
              return `<div><h3>${esc(q.text)}</h3><p><span class="tile-v"><strong>${q.mean === null ? '–' : q.mean.toFixed(1)}</strong></span> <span class="muted small">average of ${q.n}</span></p>${Array.from({ length: 10 }, (_, i) => i + 1).map((v) => `<div class="dist"><span class="num">${v}</span><div class="bar-h" style="width:${(100 * (q.distribution?.[v] || 0)) / max}%"></div><span class="num small">${q.distribution?.[v] || 0}</span></div>`).join('')}</div>`;
            }
            if (q.kind === 'yesno') return `<div><h3>${esc(q.text)}</h3><p><strong>${pct(q.yesShare)}</strong> <span class="muted small">said yes, of ${q.n}</span></p></div>`;
            return `<div><h3>${esc(q.text)}</h3><div class="responses">${q.responses.length ? q.responses.map((a) => `<p>${esc(a)}</p>`).join('') : '<p class="muted">No answers yet.</p>'}</div></div>`;
          })
          .join('')
      : '<p class="muted">No survey questions.</p>';

    for (const fmt of ['xml', 'edl', 'csv']) document.getElementById(`exp-${fmt}`).href = `/api/tests/${id}/export/${fmt}?${q}`;
  }

  document.getElementById('cut')?.addEventListener('change', async (e) => {
    state.cut = e.target.value;
    chart.view = null;
    await Promise.all([load(), loadStream()]);
  });
  document.getElementById('segment').onchange = (e) => {
    state.segment = e.target.value;
    load();
  };
  document.getElementById('smooth').onchange = (e) => chart.setSmoothing(Number(e.target.value));
  document.getElementById('synthetic').onchange = (e) => {
    state.synthetic = e.target.checked;
    load();
  };

  await Promise.all([load(), loadStream()]);
  const timer = setInterval(() => load().catch(() => {}), 60_000);
  onCleanup(() => clearInterval(timer));
}

route();
