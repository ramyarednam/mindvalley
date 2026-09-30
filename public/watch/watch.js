import { Tracker, buildEnvelope } from '/watch/tracker.js';

const $ = (id) => document.getElementById(id);
const testId = location.pathname.split('/').filter(Boolean)[1];
const params = new URLSearchParams(location.search);
const storeKey = `prewatch:${testId}`;

const SAMPLE_MS = 250;
const UPLOAD_MS = 10_000;
const CHECK_WINDOW_MS = 8000;
const PRESS_COOLDOWN_MS = 2000;

const state = {
  test: null,
  session: null, // join response
  tracker: new Tracker(),
  samples: [],
  events: [],
  pauseSec: 0,
  pausedAt: null,
  checks: [],
  activeCheck: null,
  lastPress: { interest: 0, bored: 0 },
  maxPt: 0,
  done: false,
};

// ---------- helpers ----------

function show(step) {
  for (const s of document.querySelectorAll('.step')) s.classList.toggle('hidden', s.id !== `step-${step}`);
  window.scrollTo(0, 0);
}

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(storeKey) || '{}');
  } catch {
    return {};
  }
}
function save(patch) {
  try {
    localStorage.setItem(storeKey, JSON.stringify({ ...load(), ...patch }));
  } catch {
    // Private mode: resume will not work, everything else does.
  }
}

async function api(path, body, { key } = {}) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-session-key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive: true,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

function finish(title, body, code) {
  state.done = true;
  state.tracker.stop();
  $('done-title').textContent = title;
  $('done-body').textContent = body;
  if (code) {
    $('done-code').textContent = code;
    $('done-code').classList.remove('hidden');
  }
  show('done');
}

function pid() {
  const fromUrl = params.get('pid') || params.get('PROLIFIC_PID') || params.get('participant');
  if (fromUrl) return fromUrl;
  const saved = load().pid;
  if (saved) return saved;
  const made = `anon_${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
  save({ pid: made });
  return made;
}

// ---------- 1. consent ----------

function deviceProblem() {
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches) return 'Please join from a laptop or desktop computer with a webcam. Phones and tablets are not supported yet.';
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot use a webcam. Please use a recent Chrome, Edge, Firefox or Safari.';
  if (window.innerWidth < 900) return 'Please make your browser window wider (or use a larger screen) before you start.';
  return null;
}

async function init() {
  try {
    state.test = await api(`/api/public/tests/${testId}`);
  } catch (err) {
    $('test-title').textContent = 'This link is not available';
    $('consent-next').classList.add('hidden');
    $('device-error').textContent = err.message;
    $('device-error').classList.remove('hidden');
    return;
  }
  $('test-title').textContent = state.test.title;
  document.title = `${state.test.title} · Pre-Watch`;
  if (state.test.preview) $('preview-note').classList.remove('hidden');
  if (state.test.durationSec) $('duration-label').textContent = `About ${Math.round(state.test.durationSec / 60)} minutes`;
  // Restrict demographic choices to the quota options, when a quota is set.
  const map = { age_band: 'd-age', gender: 'd-gender', country: 'd-country', member: 'd-member' };
  for (const [key, opts] of Object.entries(state.test.quotaOptions || {})) {
    const sel = $(map[key]);
    if (!sel || !opts.length) continue;
    for (const o of [...sel.options]) if (o.value && !opts.includes(o.value) && !opts.includes(o.text)) o.hidden = true;
  }
  const saved = load();
  for (const [key, id] of Object.entries(map)) if (saved.demographics?.[key]) $(id).value = saved.demographics[key];

  const problem = deviceProblem();
  $('consent').addEventListener('change', () => ($('consent-next').disabled = !$('consent').checked || !!deviceProblem()));
  if (problem) {
    $('device-error').textContent = problem;
    $('device-error').classList.remove('hidden');
  }
  $('consent-next').addEventListener('click', () => show('about'));
  $('about-next').addEventListener('click', join);
}

// ---------- 2. join ----------

async function join() {
  const demographics = {
    age_band: $('d-age').value,
    gender: $('d-gender').value,
    country: $('d-country').value,
    member: $('d-member').value,
  };
  if (Object.values(demographics).some((v) => !v)) {
    $('about-error').textContent = 'Please answer all four questions.';
    $('about-error').classList.remove('hidden');
    return;
  }
  $('about-next').disabled = true;
  try {
    state.session = await api(`/api/public/tests/${testId}/join`, { pid: pid(), consent: true, demographics });
    save({ demographics });
    state.checks = state.session.checks.map((t) => ({ t, done: false }));
    state.maxPt = state.session.resumeAt;
    show('camera');
    setupCamera();
  } catch (err) {
    if (err.status === 409) finish('Thanks for your interest', err.message);
    else {
      $('about-error').textContent = err.message;
      $('about-error').classList.remove('hidden');
      $('about-next').disabled = false;
    }
  }
}

// ---------- 3. camera + calibration ----------

async function setupCamera() {
  const status = $('cam-status');
  try {
    status.textContent = 'Requesting camera…';
    await state.tracker.startCamera($('cam'));
    status.textContent = 'Loading the attention model (about 4 MB)…';
    await state.tracker.load();
    state.tracker.start(10);
  } catch (err) {
    const denied = err?.name === 'NotAllowedError';
    $('cam-error').textContent = denied ? 'Camera access was blocked. Allow the camera in your browser address bar, then reload this page.' : `The camera or attention model could not start: ${err.message || err}`;
    $('cam-error').classList.remove('hidden');
    status.textContent = 'Camera not available';
    return;
  }
  let recent = [];
  state.tracker.onFrame((f) => {
    recent.push(f.face);
    if (recent.length > 20) recent.shift();
    const share = recent.filter(Boolean).length / recent.length;
    const ok = share > 0.8;
    status.textContent = ok ? 'Face detected. You are ready to calibrate.' : 'Looking for your face… move closer or add light in front of you.';
    status.classList.toggle('ok', ok);
    $('calib-start').disabled = !ok;
  });
  $('calib-start').addEventListener('click', calibrate);
}

const DOTS = [
  [0.08, 0.1], [0.5, 0.1], [0.92, 0.1],
  [0.08, 0.5], [0.5, 0.5], [0.92, 0.5],
  [0.08, 0.9], [0.5, 0.9], [0.92, 0.9],
];

async function calibrate(attempt = 1) {
  const layer = $('calib-layer');
  const dot = $('calib-dot');
  const text = $('calib-text');
  layer.classList.remove('hidden');
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    // Fullscreen is optional for calibration.
  }
  text.textContent = 'Look at each dot until it shrinks away';
  const points = [];
  let faceShares = [];
  for (const [x, y] of DOTS) {
    dot.style.left = `${x * 100}%`;
    dot.style.top = `${y * 100}%`;
    dot.classList.remove('shrink');
    void dot.offsetWidth;
    dot.classList.add('shrink');
    const r = await state.tracker.collect(1200, 450);
    faceShares.push(r.faceShare);
    if (Number.isFinite(r.mean.yaw)) points.push(r.mean);
    text.textContent = '';
  }
  state.tracker.envelope = points.length >= 7 ? buildEnvelope(points) : null;

  // Validation: the centre dot must read as "on screen".
  dot.style.left = '50%';
  dot.style.top = '50%';
  text.textContent = 'One more: look at the centre dot';
  let onFrames = 0;
  let frames = 0;
  const off = state.tracker.onFrame((f) => {
    frames++;
    if (f.attentive) onFrames++;
  });
  await new Promise((r) => setTimeout(r, 1200));
  off();
  layer.classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

  const faceShare = faceShares.reduce((a, b) => a + b, 0) / faceShares.length;
  const validation = frames ? onFrames / frames : 0;
  const passed = !!state.tracker.envelope && faceShare >= 0.8 && validation >= 0.6;
  const quality = { attempt, faceShare: +faceShare.toFixed(2), validation: +validation.toFixed(2), points: points.length };

  if (!passed && attempt < 3) {
    $('cam-error').textContent = `Calibration didn't work well (face seen ${Math.round(faceShare * 100)}% of the time). Check your lighting, sit square to the screen, and try again.`;
    $('cam-error').classList.remove('hidden');
    $('calib-start').textContent = 'Try again';
    $('calib-start').onclick = () => calibrate(attempt + 1);
    return;
  }
  await api(`/api/public/sessions/${state.session.sessionId}/calibration`, { passed, quality }, { key: state.session.sessionKey });
  $('cam-error').classList.add('hidden');
  show('brief');
  $('brief-next').onclick = startPlayer;
}

// ---------- 5. player ----------

let hls = null;

function attachStream(video, stream, startAt) {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  if (stream.kind === 'hls' && window.Hls?.isSupported()) {
    hls = new window.Hls({ startPosition: startAt, maxBufferLength: 60, capLevelToPlayerSize: true });
    hls.on(window.Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) refreshStream();
      else hls.recoverMediaError();
    });
    hls.loadSource(stream.src);
    hls.attachMedia(video);
  } else {
    video.src = stream.src; // Safari plays HLS natively; MP4 everywhere.
    video.addEventListener('loadedmetadata', () => (video.currentTime = startAt), { once: true });
  }
}

let refreshing = false;
async function refreshStream() {
  if (refreshing) return;
  refreshing = true;
  const video = $('player');
  const at = video.currentTime || state.maxPt;
  try {
    const stream = await api(`/api/public/sessions/${state.session.sessionId}/stream`, {}, { key: state.session.sessionKey });
    attachStream(video, stream, at);
    video.play().catch(() => {});
  } catch {
    message('The video connection dropped. Please reload the page to continue where you left off.');
  } finally {
    setTimeout(() => (refreshing = false), 5000);
  }
}

function message(text) {
  const el = $('player-msg');
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

function pulse(id) {
  const el = $(id);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 500);
}

function logEvent(type, data) {
  state.events.push({ type, pt: +$('player').currentTime.toFixed(2), ts: Date.now(), ...(data ? { data } : {}) });
}

function startPlayer() {
  show('player');
  const video = $('player');
  const { range, stream, shortId } = state.session;
  $('watermark').textContent = shortId;
  attachStream(video, stream, state.maxPt);

  // Locked playback: no seeking, no speed change (PRD PX-4).
  let lastGood = state.maxPt;
  let seekingBack = false;
  video.addEventListener('timeupdate', () => {
    if (!video.seeking && Math.abs(video.currentTime - lastGood) < 2) lastGood = video.currentTime;
    state.maxPt = Math.max(state.maxPt, video.currentTime);
    const pos = video.currentTime - range.start;
    const span = range.end - range.start;
    $('time').textContent = `${fmt(pos)} / ${fmt(span)}`;
    $('progress').style.width = `${Math.min(100, (100 * pos) / span)}%`;
    if (video.currentTime >= range.end - 0.3) endOfVideo();
  });
  video.addEventListener('seeking', () => {
    if (seekingBack || !hlsReadyForSeek()) return;
    if (Math.abs(video.currentTime - lastGood) > 1.5) {
      seekingBack = true;
      logEvent('seek_blocked', { to: +video.currentTime.toFixed(1) });
      video.currentTime = lastGood;
      setTimeout(() => (seekingBack = false), 300);
    }
  });
  video.addEventListener('ratechange', () => {
    if (video.playbackRate !== 1) {
      video.playbackRate = 1;
      logEvent('rate_blocked');
    }
  });
  video.addEventListener('contextmenu', (e) => e.preventDefault());
  video.addEventListener('play', () => {
    if (state.pausedAt) state.pauseSec += (Date.now() - state.pausedAt) / 1000;
    state.pausedAt = null;
    $('play').textContent = 'Pause';
    logEvent('play');
    message('');
  });
  video.addEventListener('pause', () => {
    if (state.done || video.currentTime >= range.end - 0.3) return;
    state.pausedAt = Date.now();
    $('play').textContent = 'Play';
    logEvent('pause');
    if (state.pauseSec > state.session.maxPauseSec) message('You have paused for a long time. Please continue when you can; long breaks make the results less reliable.');
  });
  video.addEventListener('waiting', () => $('track-dot').classList.remove('on'));

  $('play').onclick = () => (video.paused ? video.play() : video.pause());
  $('volume').oninput = (e) => (video.volume = Number(e.target.value));
  $('fullscreen').onclick = () => ($('stage').requestFullscreen ? $('stage').requestFullscreen() : video.requestFullscreen?.());
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) logEvent('fullscreen_exit');
  });
  document.addEventListener('visibilitychange', () => logEvent(document.visibilityState === 'visible' ? 'tab_visible' : 'tab_hidden'));
  document.addEventListener('keydown', onKey);

  // Wandering watermark makes leaked screen recordings traceable.
  setInterval(() => {
    const wm = $('watermark');
    wm.style.top = `${8 + Math.random() * 70}%`;
    wm.style.right = `${2 + Math.random() * 70}%`;
  }, 20_000);

  setInterval(sample, SAMPLE_MS);
  setInterval(upload, UPLOAD_MS);
  addEventListener('pagehide', () => upload());
  video.play().catch(() => message('Press Play to start.'));
}

function hlsReadyForSeek() {
  return $('player').readyState >= 1;
}

function onKey(e) {
  if (state.done || $('step-player').classList.contains('hidden')) return;
  if (e.target instanceof HTMLInputElement) return;
  const video = $('player');
  const now = Date.now();
  if (e.code === 'Space') {
    e.preventDefault();
    if (video.paused) return;
    if (now - state.lastPress.interest < PRESS_COOLDOWN_MS) return pulse('pulse');
    state.lastPress.interest = now;
    logEvent('interest');
    pulse('pulse');
  } else if (e.code === 'KeyB') {
    if (video.paused || now - state.lastPress.bored < PRESS_COOLDOWN_MS) return;
    state.lastPress.bored = now;
    logEvent('bored');
    pulse('pulse-b');
  } else if (e.code === 'KeyA' && state.activeCheck) {
    logEvent('check_passed', { at: state.activeCheck.t });
    closeCheck();
  } else if (e.code === 'KeyP') {
    video.paused ? video.play() : video.pause();
  }
}

function openCheck(check) {
  check.done = true;
  state.activeCheck = check;
  logEvent('check_shown', { at: check.t });
  const el = $('check');
  el.classList.remove('hidden');
  const bar = el.querySelector('.bar span');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  void bar.offsetWidth;
  bar.style.transition = `width ${CHECK_WINDOW_MS}ms linear`;
  bar.style.width = '0%';
  check.timer = setTimeout(() => {
    logEvent('check_missed', { at: check.t });
    closeCheck();
  }, CHECK_WINDOW_MS);
}

function closeCheck() {
  clearTimeout(state.activeCheck?.timer);
  state.activeCheck = null;
  $('check').classList.add('hidden');
}

function sample() {
  const video = $('player');
  const s = state.tracker.drain();
  const playing = !video.paused && !video.ended && video.readyState >= 3;
  $('track-dot').className = `track-dot ${!playing ? '' : s.attentive ? 'on' : 'off'}`;
  if (!playing) return;
  const visible = document.visibilityState === 'visible' ? 1 : 0;
  state.samples.push([+video.currentTime.toFixed(2), s.face, s.attentive, visible]);
  const due = state.checks.find((c) => !c.done && video.currentTime >= c.t);
  if (due && !state.activeCheck) openCheck(due);
}

let uploading = false;
// Uses fetch with keepalive (not sendBeacon) so the session key header survives a closing tab.
async function upload() {
  if (!state.session || uploading || (!state.samples.length && !state.events.length)) return;
  const samples = state.samples.splice(0, 2000);
  const events = state.events.splice(0, 500);
  const body = { samples, events, pauseSec: Math.round(state.pauseSec) };
  uploading = true;
  try {
    await api(`/api/public/sessions/${state.session.sessionId}/signals`, body, { key: state.session.sessionKey });
  } catch {
    // Network blip: put the data back and try next time (PRD SC-4).
    state.samples.unshift(...samples);
    state.events.unshift(...events);
  } finally {
    uploading = false;
  }
}

async function endOfVideo() {
  if (state.done || !$('step-survey').classList.contains('hidden')) return;
  const video = $('player');
  video.pause();
  closeCheck();
  await upload();
  state.tracker.stop();
  buildSurvey();
  show('survey');
}

// ---------- 6. survey ----------

function buildSurvey() {
  const form = $('survey');
  form.innerHTML = '';
  for (const q of state.test.survey) {
    const wrap = document.createElement('div');
    wrap.className = 'survey-q';
    const label = document.createElement('label');
    label.textContent = q.text;
    wrap.append(label);
    if (q.kind === 'scale') {
      const row = document.createElement('div');
      row.className = 'scale';
      for (let i = 1; i <= 10; i++) row.insertAdjacentHTML('beforeend', `<label><input type="radio" name="${q.id}" value="${i}" />${i}</label>`);
      wrap.append(row);
    } else if (q.kind === 'yesno') {
      const row = document.createElement('div');
      row.className = 'yesno';
      row.innerHTML = `<label><input type="radio" name="${q.id}" value="yes" />Yes</label><label><input type="radio" name="${q.id}" value="no" />No</label>`;
      wrap.append(row);
    } else {
      const ta = document.createElement('textarea');
      ta.name = q.id;
      ta.maxLength = 2000;
      wrap.append(ta);
    }
    form.append(wrap);
  }
  $('survey-submit').onclick = submitSurvey;
}

async function submitSurvey() {
  const data = Object.fromEntries(new FormData($('survey')).entries());
  const missing = state.test.survey.filter((q) => q.kind !== 'text' && !data[q.id]);
  if (missing.length) {
    $('survey-error').textContent = 'Please answer the rating and yes/no questions.';
    $('survey-error').classList.remove('hidden');
    return;
  }
  $('survey-submit').disabled = true;
  try {
    await upload();
    const out = await api(`/api/public/sessions/${state.session.sessionId}/complete`, { survey: data }, { key: state.session.sessionKey });
    if (out.redirect) {
      location.href = out.redirect;
      return;
    }
    finish('Thank you!', 'Your viewing has been recorded. If you were sent here by a panel provider, enter this completion code there:', out.completionCode);
  } catch (err) {
    $('survey-error').textContent = err.message;
    $('survey-error').classList.remove('hidden');
    $('survey-submit').disabled = false;
  }
}

init();
