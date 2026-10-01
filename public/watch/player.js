import { fmtTime } from '/shared/ui.js';
import { api, message, save, show, showSaved, state } from '/watch/watch.js';
import { startFeedback } from '/watch/feedback.js';

const $ = (id) => document.getElementById(id);
const SAMPLE_MS = 250;
const UPLOAD_MS = 10_000;
const CHECK_WINDOW_MS = 8000;
const PRESS_COOLDOWN_MS = 2000;

const p = {
  samples: [],
  events: [],
  pauseSec: 0,
  pausedAt: null,
  checks: [],
  activeCheck: null,
  lastPress: { interest: 0, bored: 0 },
  presses: 0,
  maxPt: 0,
  ended: false,
  timers: [],
  hls: null,
};

function attachStream(video, stream, startAt) {
  p.hls?.destroy();
  p.hls = null;
  if (stream.kind === 'hls' && window.Hls?.isSupported()) {
    p.hls = new window.Hls({ startPosition: startAt, maxBufferLength: 60, capLevelToPlayerSize: true });
    p.hls.on(window.Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) refreshStream();
      else p.hls.recoverMediaError();
    });
    p.hls.loadSource(stream.src);
    p.hls.attachMedia(video);
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
  const at = video.currentTime || p.maxPt;
  const s = state.session;
  try {
    attachStream(video, await api(`/api/public/sessions/${s.sessionId}/stream`, {}, { key: s.sessionKey }), at);
    video.play().catch(() => {});
  } catch {
    overlay('The video connection dropped. Reload the page and you will continue where you left off.');
  } finally {
    setTimeout(() => (refreshing = false), 5000);
  }
}

function overlay(text) {
  const el = $('player-msg');
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

function pulse(id) {
  const el = $(id);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 550);
}

function logEvent(type, data) {
  p.events.push({ type, pt: +$('player').currentTime.toFixed(2), ts: Date.now(), ...(data ? { data } : {}) });
}

export function startPlayer() {
  show('player');
  const s = state.session;
  const video = $('player');
  const { range } = s;
  p.maxPt = s.resumeAt;
  p.checks = s.checks.map((t) => ({ t, done: false }));
  $('watermark').textContent = s.shortId;
  attachStream(video, s.stream, p.maxPt);

  // Locked playback: no skipping, no speed change (PRD PX-4).
  let lastGood = p.maxPt;
  let correcting = false;
  video.addEventListener('timeupdate', () => {
    if (!video.seeking && Math.abs(video.currentTime - lastGood) < 2) lastGood = video.currentTime;
    p.maxPt = Math.max(p.maxPt, video.currentTime);
    const pos = video.currentTime - range.start;
    const span = range.end - range.start;
    $('time').textContent = `${fmtTime(pos)} / ${fmtTime(span)}`;
    $('progress').style.width = `${Math.min(100, (100 * pos) / span)}%`;
    if (video.currentTime >= range.end - 0.3) finishWatching();
  });
  video.addEventListener('seeking', () => {
    if (correcting || video.readyState < 1) return;
    if (Math.abs(video.currentTime - lastGood) > 1.5) {
      correcting = true;
      logEvent('seek_blocked', { to: +video.currentTime.toFixed(1) });
      video.currentTime = lastGood;
      setTimeout(() => (correcting = false), 300);
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
    if (p.pausedAt) p.pauseSec += (Date.now() - p.pausedAt) / 1000;
    p.pausedAt = null;
    $('play').textContent = 'Pause';
    logEvent('play');
    overlay('');
  });
  video.addEventListener('pause', () => {
    if (p.ended || video.currentTime >= range.end - 0.3) return;
    p.pausedAt = Date.now();
    $('play').textContent = 'Play';
    logEvent('pause');
    if (p.pauseSec > s.maxPauseSec) overlay('Need a longer break? Use "Save & finish later" and come back with your personal link.');
  });

  $('play').onclick = () => (video.paused ? video.play() : video.pause());
  $('volume').oninput = (e) => (video.volume = Number(e.target.value));
  $('fullscreen').onclick = () => ($('stage').requestFullscreen ? $('stage').requestFullscreen() : video.requestFullscreen?.());
  $('save-later').onclick = saveForLater;
  document.addEventListener('fullscreenchange', () => !document.fullscreenElement && logEvent('fullscreen_exit'));
  document.addEventListener('visibilitychange', () => logEvent(document.visibilityState === 'visible' ? 'tab_visible' : 'tab_hidden'));
  document.addEventListener('keydown', onKey);

  // A wandering watermark makes a leaked screen recording traceable.
  p.timers.push(setInterval(() => {
    const wm = $('watermark');
    wm.style.top = `${8 + Math.random() * 70}%`;
    wm.style.right = `${2 + Math.random() * 70}%`;
  }, 20_000));
  p.timers.push(setInterval(sample, SAMPLE_MS));
  p.timers.push(setInterval(upload, UPLOAD_MS));
  addEventListener('pagehide', () => upload());
  video.play().catch(() => overlay('Press Play to start.'));
}

function onKey(e) {
  if (p.ended || $('step-player').classList.contains('hidden')) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const video = $('player');
  const now = Date.now();
  if (e.code === 'Space') {
    e.preventDefault();
    if (video.paused) return;
    if (now - p.lastPress.interest < PRESS_COOLDOWN_MS) return pulse('pulse');
    p.lastPress.interest = now;
    p.presses++;
    $('press-count').textContent = `${p.presses} moment${p.presses === 1 ? '' : 's'} marked`;
    logEvent('interest');
    pulse('pulse');
  } else if (e.code === 'KeyB') {
    if (video.paused || now - p.lastPress.bored < PRESS_COOLDOWN_MS) return;
    p.lastPress.bored = now;
    logEvent('bored');
    pulse('pulse-b');
  } else if (e.code === 'KeyA' && p.activeCheck) {
    logEvent('check_passed', { at: p.activeCheck.t });
    closeCheck();
  } else if (e.code === 'KeyP') {
    video.paused ? video.play() : video.pause();
  }
}

function openCheck(check) {
  check.done = true;
  p.activeCheck = check;
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
  clearTimeout(p.activeCheck?.timer);
  p.activeCheck = null;
  $('check').classList.add('hidden');
}

function sample() {
  const video = $('player');
  const s = state.tracker.drain();
  const playing = !video.paused && !video.ended && video.readyState >= 3;
  $('track-dot').className = `track-dot ${!playing ? '' : s.attentive ? 'on' : 'off'}`;
  if (!playing) return;
  p.samples.push([+video.currentTime.toFixed(2), s.face, s.attentive, document.visibilityState === 'visible' ? 1 : 0]);
  const due = p.checks.find((c) => !c.done && video.currentTime >= c.t);
  if (due && !p.activeCheck) openCheck(due);
}

// Uses fetch with keepalive (not sendBeacon) so the session key header survives a closing tab.
let uploading = false;
async function upload() {
  const s = state.session;
  if (!s || uploading || (!p.samples.length && !p.events.length)) return;
  const samples = p.samples.splice(0, 2000);
  const events = p.events.splice(0, 500);
  uploading = true;
  try {
    await api(`/api/public/sessions/${s.sessionId}/signals`, { samples, events, pauseSec: Math.round(p.pauseSec) }, { key: s.sessionKey });
  } catch {
    // Network blip: keep the data and try again next time (PRD SC-4).
    p.samples.unshift(...samples);
    p.events.unshift(...events);
  } finally {
    uploading = false;
  }
}

async function flush() {
  for (let i = 0; i < 5 && (p.samples.length || p.events.length); i++) {
    while (uploading) await new Promise((r) => setTimeout(r, 100));
    await upload();
  }
}

function stopPlayback() {
  p.ended = true;
  $('player').pause();
  closeCheck();
  for (const t of p.timers) clearInterval(t);
  p.timers = [];
  p.hls?.destroy();
  state.tracker.stop();
}

async function saveForLater() {
  logEvent('save_later');
  const at = $('player').currentTime;
  stopPlayback();
  await flush();
  state.session.resumeAt = Math.max(at, p.maxPt);
  save({ resumeKey: state.session.resumeKey });
  showSaved('watch');
}

async function finishWatching() {
  if (p.ended) return;
  stopPlayback();
  await flush();
  const s = state.session;
  try {
    await api(`/api/public/sessions/${s.sessionId}/watched`, {}, { key: s.sessionKey });
  } catch (err) {
    return message('⚠️', 'We could not save your viewing', `${err.message} Reload the page to try again.`);
  }
  s.stage = 'feedback';
  startFeedback(true);
}
