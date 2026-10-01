import { Tracker, buildEnvelope } from '/watch/tracker.js';
import { esc, fmtDuration, fmtTime, copyText } from '/shared/ui.js';
import { startPlayer } from '/watch/player.js';
import { startFeedback } from '/watch/feedback.js';

const $ = (id) => document.getElementById(id);
const testId = location.pathname.split('/').filter(Boolean)[1];
const params = new URLSearchParams(location.search);
const storeKey = `prewatch:${testId}`;

export const state = { test: null, session: null, tracker: new Tracker(), demographics: {} };

// ---------- helpers ----------

export function show(step) {
  for (const s of document.querySelectorAll('.step')) s.classList.toggle('hidden', s.id !== `step-${step}`);
  window.scrollTo(0, 0);
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(storeKey) || '{}');
  } catch {
    return {};
  }
}
export function save(patch) {
  try {
    localStorage.setItem(storeKey, JSON.stringify({ ...load(), ...patch }));
  } catch {
    // Private mode: the personal resume link still works.
  }
}

export async function api(path, body, { key, method } = {}) {
  const res = await fetch(path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { 'content-type': 'application/json', ...(key ? { 'x-session-key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive: true,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Something went wrong (${res.status})`), { status: res.status });
  return data;
}

export function message(emoji, title, body) {
  state.tracker.stop();
  $('msg-emoji').textContent = emoji;
  $('msg-title').textContent = title;
  $('msg-body').textContent = body;
  show('message');
}

export function resumeUrl() {
  return `${location.origin}${state.session.resumePath}`;
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

function setBackdrop(url) {
  if (!url) return;
  const b = $('backdrop');
  b.style.backgroundImage = `url("${url}")`;
  b.classList.add('poster');
}

function deviceProblem() {
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches) return 'Please join from a laptop or desktop with a webcam. Phones and tablets are not supported for watching yet.';
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot use a webcam. Please use a recent Chrome, Edge, Firefox or Safari.';
  if (window.innerWidth < 900) return 'Please make your browser window wider (or use a bigger screen) before you start.';
  return null;
}

// ---------- start ----------

async function init() {
  // A personal link (?resume=...) or a remembered spot in this browser picks up where the viewer left off.
  const resumeKey = params.get('resume') || load().resumeKey;
  if (resumeKey) {
    try {
      state.session = await api('/api/public/resume', { resumeKey });
      save({ resumeKey: state.session.resumeKey });
      setBackdrop(state.session.posterUrl);
      return welcomeBack();
    } catch (err) {
      if (params.get('resume')) return message('🔍', 'Link not found', err.message);
      save({ resumeKey: null });
    }
  }
  try {
    state.test = await api(`/api/public/tests/${testId}`);
  } catch (err) {
    return message('🎬', err.status === 403 ? 'This screening is not open' : 'This link is not available', err.message);
  }
  renderIntro();
}

function renderIntro() {
  const t = state.test;
  document.title = `${t.title} · Pre-Watch`;
  setBackdrop(t.posterUrl);
  if (t.posterUrl) $('hero-media').style.backgroundImage = `url("${t.posterUrl}"), var(--grad)`;
  $('test-title').textContent = t.title;
  $('test-desc').textContent = t.description || 'Watch the full episode before it is released and help us make it even better.';
  $('test-chips').innerHTML = [t.durationSec ? `⏱ ${fmtDuration(t.durationSec)}` : '', '🎧 Sound on', '💻 Laptop + webcam'].filter(Boolean).map((c) => `<span class="chip">${c}</span>`).join('');
  if (t.preview) $('preview-note').classList.remove('hidden');
  const problem = deviceProblem();
  if (problem) {
    $('device-error').textContent = problem;
    $('device-error').classList.remove('hidden');
  }
  $('consent').addEventListener('change', () => ($('consent-next').disabled = !$('consent').checked || !!deviceProblem()));
  $('consent-next').onclick = () => {
    show('about');
    setupAbout();
  };
  show('consent');
}

// ---------- about you ----------

function setupAbout() {
  const saved = load().demographics || {};
  state.demographics = { ...saved };
  const quota = state.test.quotaOptions || {};
  for (const row of document.querySelectorAll('.choice-row')) {
    const name = row.dataset.name;
    for (const b of row.querySelectorAll('button')) {
      if (quota[name]?.length && !quota[name].includes(b.dataset.v)) b.classList.add('hidden');
      b.classList.toggle('on', saved[name] === b.dataset.v);
      b.onclick = () => {
        state.demographics[name] = b.dataset.v;
        for (const o of row.querySelectorAll('button')) o.classList.toggle('on', o === b);
      };
    }
  }
  const sel = $('d-country');
  if (quota.country?.length) for (const o of [...sel.options]) if (o.value && !quota.country.includes(o.value)) o.hidden = true;
  if (saved.country) sel.value = saved.country;
  sel.onchange = () => (state.demographics.country = sel.value);
  $('about-next').onclick = join;
}

async function join() {
  const d = state.demographics;
  if (!d.age_band || !d.gender || !d.country || !d.member) {
    $('about-error').textContent = 'Please answer all four so we can include you.';
    $('about-error').classList.remove('hidden');
    return;
  }
  $('about-next').disabled = true;
  try {
    state.session = await api(`/api/public/tests/${testId}/join`, { pid: pid(), consent: true, demographics: d });
    save({ demographics: d, resumeKey: state.session.resumeKey });
    // The shareable preview has no camera or video, so it goes straight to the questionnaire.
    if (window.__PW_PREVIEW__) return startFeedback(true);
    if (state.session.stage !== 'watch' || state.session.resumeAt > state.session.range.start + 5) return welcomeBack();
    show('camera');
    setupCamera();
  } catch (err) {
    if (err.status === 409) message('🙏', 'Thanks for your interest', err.message);
    else {
      $('about-error').textContent = err.message;
      $('about-error').classList.remove('hidden');
      $('about-next').disabled = false;
    }
  }
}

// ---------- welcome back ----------

function welcomeBack() {
  const s = state.session;
  document.title = `${s.title} · Pre-Watch`;
  if (s.stage === 'done') return done(s.completionCode, true);
  const span = s.range.end - s.range.start;
  const watched = Math.min(span, s.resumeAt - s.range.start);
  $('wb-progress').style.width = `${(100 * watched) / span}%`;
  if (s.stage === 'feedback') {
    $('wb-text').textContent = `You finished watching "${s.title}". There are just a few quick questions left.`;
    $('wb-meta').textContent = 'About 3 minutes. You can do this on any device.';
    $('wb-go').textContent = 'Give my feedback';
    $('wb-go').onclick = () => startFeedback();
  } else {
    $('wb-text').textContent = `You stopped at ${fmtTime(watched)} of "${s.title}". Pick up right where you left off.`;
    $('wb-meta').textContent = `${fmtTime(span - watched)} left to watch.`;
    $('wb-go').textContent = 'Continue watching';
    const problem = deviceProblem();
    if (problem) {
      $('wb-meta').textContent = problem;
      $('wb-go').disabled = true;
    }
    $('wb-go').onclick = () => {
      $('cam-eyebrow').textContent = 'Quick re-check';
      show('camera');
      setupCamera();
    };
  }
  show('welcome-back');
}

// ---------- camera + calibration ----------

async function setupCamera() {
  const status = $('cam-status');
  try {
    status.textContent = 'Asking for your camera…';
    if (!state.tracker.stream) await state.tracker.startCamera($('cam'));
    status.textContent = 'Loading the attention model (about 4 MB)…';
    if (!state.tracker.landmarker) await state.tracker.load();
    state.tracker.start(10);
  } catch (err) {
    const denied = err?.name === 'NotAllowedError';
    $('cam-error').textContent = denied ? 'Camera access was blocked. Allow the camera using the icon in your address bar, then reload this page.' : `The camera could not start: ${err.message || err}`;
    $('cam-error').classList.remove('hidden');
    status.textContent = 'Camera not available';
    return;
  }
  const recent = [];
  state.tracker.onFrame((f) => {
    recent.push(f.face);
    if (recent.length > 20) recent.shift();
    const ok = recent.filter(Boolean).length / recent.length > 0.8;
    status.textContent = ok ? 'Looking good! You are ready to calibrate.' : 'Looking for your face… move closer or add some light in front of you.';
    status.classList.toggle('ok', ok);
    $('cam-frame').classList.toggle('ok', ok);
    $('calib-start').disabled = !ok;
  });
  $('calib-start').onclick = () => calibrate(1);
}

const DOTS = [
  [0.08, 0.1], [0.5, 0.1], [0.92, 0.1],
  [0.08, 0.5], [0.5, 0.5], [0.92, 0.5],
  [0.08, 0.9], [0.5, 0.9], [0.92, 0.9],
];

async function calibrate(attempt) {
  const layer = $('calib-layer');
  const dot = $('calib-dot');
  const text = $('calib-text');
  layer.classList.remove('hidden');
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    // Fullscreen is optional.
  }
  text.textContent = 'Follow the dot with your eyes';
  const points = [];
  const faceShares = [];
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
  dot.style.left = '50%';
  dot.style.top = '50%';
  text.textContent = 'Last one: the centre';
  let on = 0;
  let frames = 0;
  const off = state.tracker.onFrame((f) => {
    frames++;
    if (f.attentive) on++;
  });
  await new Promise((r) => setTimeout(r, 1200));
  off();
  layer.classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

  const faceShare = faceShares.reduce((a, b) => a + b, 0) / faceShares.length;
  const validation = frames ? on / frames : 0;
  const passed = !!state.tracker.envelope && faceShare >= 0.8 && validation >= 0.6;
  if (!passed && attempt < 3) {
    $('cam-error').textContent = `That didn't quite work (we saw your face ${Math.round(faceShare * 100)}% of the time). Check the lighting, sit square to the screen and try again.`;
    $('cam-error').classList.remove('hidden');
    $('calib-start').textContent = 'Try again';
    $('calib-start').onclick = () => calibrate(attempt + 1);
    return;
  }
  const s = state.session;
  await api(`/api/public/sessions/${s.sessionId}/calibration`, { passed, quality: { attempt, faceShare: +faceShare.toFixed(2), validation: +validation.toFixed(2), points: points.length } }, { key: s.sessionKey });
  $('cam-error').classList.add('hidden');
  if (s.resumeAt > s.range.start + 5) return startPlayer();
  show('brief');
  $('brief-next').onclick = startPlayer;
}

// ---------- saved for later / done ----------

export function showSaved(kind) {
  const s = state.session;
  const url = resumeUrl();
  $('saved-text').textContent = kind === 'feedback' ? 'Your answers so far are saved. Use your personal link to finish the questions whenever you like, on any device.' : `You stopped at ${fmtTime(s.resumeAt - s.range.start)}. Use your personal link within 7 days to continue exactly where you left off.`;
  $('resume-link').value = url;
  $('copy-link').onclick = () => copyText(url);
  $('email-link').href = `mailto:?subject=${encodeURIComponent(`Continue watching: ${s.title}`)}&body=${encodeURIComponent(`Pick up where I left off:\n${url}`)}`;
  $('continue-now').onclick = () => (kind === 'feedback' ? startFeedback() : location.assign(url));
  show('saved');
}

export function done(code, already = false) {
  state.tracker.stop();
  save({ resumeKey: state.session?.resumeKey });
  if (already) $('done-body').textContent = 'You already finished this screening. Thank you for your help!';
  if (code) {
    $('done-code').textContent = code;
    $('done-code-wrap').classList.remove('hidden');
  }
  show('done');
  if (!already) confetti();
}

function confetti() {
  const cv = $('confetti');
  const g = cv.getContext('2d');
  cv.width = innerWidth;
  cv.height = innerHeight;
  const colors = ['#9b82ff', '#ff6b9a', '#3fd391', '#ffd25e', '#5bbde3'];
  const bits = Array.from({ length: 160 }, () => ({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, r: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6 }));
  let frame = 0;
  const tick = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    for (const b of bits) {
      b.x += b.vx;
      b.y += b.vy;
      b.a += 0.1;
      g.fillStyle = b.c;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.a);
      g.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2);
      g.restore();
    }
    if (++frame < 260) requestAnimationFrame(tick);
    else g.clearRect(0, 0, cv.width, cv.height);
  };
  tick();
}

export { esc };
init();
