// On-device attention tracker (PRD SC-1). Webcam frames are processed here and never leave the browser;
// only a yes/no "looking at the screen" value per sample is sent to the server.

const MP_VERSION = '1.0.1';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Face mesh landmark indices (478-point model with irises).
const L = {
  rOuter: 33, rInner: 133, rUpper: 159, rLower: 145, rIris: 468,
  lInner: 362, lOuter: 263, lUpper: 386, lLower: 374, lIris: 473,
  nose: 1, faceLeft: 234, faceRight: 454, forehead: 10, chin: 152,
};

const FEATURES = ['yaw', 'pitch', 'irisH', 'irisV'];
/** Minimum tolerance around the calibrated envelope, per feature. */
const MIN_MARGIN = { yaw: 0.05, pitch: 0.05, irisH: 0.06, irisV: 0.1 };
const EYES_CLOSED = 0.12;

const ratio = (v, a, b) => (b - a === 0 ? 0.5 : (v - a) / (b - a));

/** Head pose and iris position as simple ratios; robust enough for on/off-screen, not for pixel gaze. */
export function featuresFrom(lm) {
  const p = (i) => lm[i];
  const yaw = ratio(p(L.nose).x, p(L.faceLeft).x, p(L.faceRight).x);
  const pitch = ratio(p(L.nose).y, p(L.forehead).y, p(L.chin).y);
  const rH = ratio(p(L.rIris).x, p(L.rOuter).x, p(L.rInner).x);
  const lH = ratio(p(L.lIris).x, p(L.lInner).x, p(L.lOuter).x);
  const rV = ratio(p(L.rIris).y, p(L.rUpper).y, p(L.rLower).y);
  const lV = ratio(p(L.lIris).y, p(L.lUpper).y, p(L.lLower).y);
  const rOpen = Math.abs(p(L.rLower).y - p(L.rUpper).y) / Math.max(1e-6, Math.abs(p(L.rInner).x - p(L.rOuter).x));
  const lOpen = Math.abs(p(L.lLower).y - p(L.lUpper).y) / Math.max(1e-6, Math.abs(p(L.lOuter).x - p(L.lInner).x));
  return { yaw, pitch, irisH: (rH + lH) / 2, irisV: (rV + lV) / 2, open: (rOpen + lOpen) / 2 };
}

/** Builds the on-screen envelope from the mean features recorded at each calibration dot. */
export function buildEnvelope(points) {
  const env = {};
  for (const f of FEATURES) {
    const vals = points.map((p) => p[f]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const margin = Math.max(MIN_MARGIN[f], (hi - lo) * 0.35);
    env[f] = [lo - margin, hi + margin];
  }
  return env;
}

export function isAttentive(feat, env) {
  if (!feat || !env) return false;
  if (feat.open < EYES_CLOSED) return false;
  return FEATURES.every((f) => feat[f] >= env[f][0] && feat[f] <= env[f][1]);
}

export class Tracker {
  constructor() {
    this.landmarker = null;
    this.video = null;
    this.stream = null;
    this.envelope = null;
    this.last = null; // { t, face, feat }
    this.frames = []; // frames since last drain
    this.listeners = new Set();
    this.running = false;
  }

  async load() {
    const { FaceLandmarker, FilesetResolver } = await import(`${MP_BASE}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numFaces: 1 });
    try {
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, opts('GPU'));
    } catch {
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, opts('CPU'));
    }
  }

  async startCamera(videoEl) {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    videoEl.srcObject = this.stream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    await videoEl.play();
    this.video = videoEl;
  }

  start(fps = 10) {
    if (this.running) return;
    this.running = true;
    let lastVideoTime = -1;
    const interval = 1000 / fps;
    const tick = () => {
      if (!this.running) return;
      const v = this.video;
      if (v && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
        lastVideoTime = v.currentTime;
        const now = performance.now();
        let face = false;
        let feat = null;
        try {
          const res = this.landmarker.detectForVideo(v, now);
          const lm = res.faceLandmarks?.[0];
          if (lm && lm.length >= 478) {
            face = true;
            feat = featuresFrom(lm);
          }
        } catch {
          // A dropped frame is treated as "no face"; the next frame retries.
        }
        const frame = { t: now, face, feat, attentive: face && isAttentive(feat, this.envelope) };
        this.last = frame;
        this.frames.push(frame);
        if (this.frames.length > 200) this.frames.shift();
        for (const fn of this.listeners) fn(frame);
      }
      this.timer = setTimeout(tick, interval);
    };
    tick();
  }

  onFrame(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Summarises frames since the previous call into one sample: majority vote, "face" if any frame had one. */
  drain() {
    const frames = this.frames;
    this.frames = [];
    if (!frames.length) {
      // Slow machines can go a whole 250 ms without a detector frame; reuse the latest one if it is fresh.
      const last = this.last && performance.now() - this.last.t < 1000 ? this.last : null;
      return { face: last?.face ? 1 : 0, attentive: last?.attentive ? 1 : 0, frames: 0 };
    }
    const att = frames.filter((f) => f.attentive).length;
    return { face: frames.some((f) => f.face) ? 1 : 0, attentive: att * 2 >= frames.length ? 1 : 0, frames: frames.length };
  }

  /** Collects feature means while the viewer looks at a dot; ignores the first `settleMs` while their eyes move. */
  async collect(ms = 1200, settleMs = 450) {
    const got = [];
    let total = 0;
    const off = this.onFrame((f) => {
      total++;
      if (f.face && f.feat) got.push(f);
    });
    await new Promise((r) => setTimeout(r, settleMs));
    got.length = 0;
    total = 0;
    await new Promise((r) => setTimeout(r, ms - settleMs));
    off();
    const mean = {};
    for (const k of [...FEATURES, 'open']) mean[k] = got.length ? got.reduce((a, f) => a + f.feat[k], 0) / got.length : NaN;
    return { mean, faceShare: total ? got.length / total : 0, frames: total };
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
