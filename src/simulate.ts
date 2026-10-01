import type { Store } from './db.ts';
import { newId } from './db.ts';
import { evaluateSession, rangeFor } from './quality.ts';
import type { CutRow, Feedback, TestRow } from './types.ts';

/**
 * Synthetic panel generator. It lets the studio see a full report before real viewers arrive and is used in tests.
 * Every row it writes is flagged synthetic=1 and can be deleted from the studio.
 */

function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T extends string>(r: () => number, weights: [T, number][]): T {
  const total = weights.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [v, w] of weights) if ((x -= w) <= 0) return v;
  return weights[weights.length - 1][0];
}

const AGE: [string, number][] = [['18-24', 15], ['25-34', 30], ['35-44', 28], ['45-54', 17], ['55+', 10]];
const GENDER: [string, number][] = [['female', 55], ['male', 43], ['other', 2]];
const COUNTRY: [string, number][] = [['US', 35], ['UK', 15], ['IN', 15], ['AU', 8], ['CA', 8], ['DE', 6], ['MY', 5], ['other', 8]];
const MEMBER: [string, number][] = [['member', 40], ['non-member', 60]];

type Story = {
  dips: { start: number; len: number; depth: number; ageBias: string }[];
  peaks: { at: number; width: number; strength: number; ageBias: string }[];
};

/** A fixed "shape" for each cut so every synthetic viewer reacts to the same moments. */
export function storyFor(cutId: string, start: number, end: number): Story {
  const r = rng(`story:${cutId}`);
  const span = end - start;
  const dips = Array.from({ length: Math.max(1, Math.round(span / 900)) }, () => ({
    start: start + 90 + r() * Math.max(1, span - 300),
    len: 40 + r() * 110,
    depth: 0.15 + r() * 0.2,
    ageBias: AGE[Math.floor(r() * AGE.length)][0],
  }));
  const peaks = Array.from({ length: Math.max(2, Math.round(span / 500)) }, () => ({
    at: start + 30 + r() * Math.max(1, span - 60),
    width: 6 + r() * 14,
    strength: 0.2 + r() * 0.4,
    ageBias: AGE[Math.floor(r() * AGE.length)][0],
  }));
  return { dips, peaks };
}

// Placeholder answers for synthetic viewers only. Reports label synthetic data, so these never pass as real quotes.
const SIM_WHY = ['[synthetic] The personal story made it feel real', '[synthetic] Practical tips I can use this week', '[synthetic] The science explained simply', '[synthetic] Surprising and honest answer'];
const SIM_ONE_LINER = ['[synthetic] A practical guide to living longer and feeling better', '[synthetic] Ben Greenfield on habits that actually move the needle'];
const SIM_TITLES = ['[synthetic] The 5 Habits That Changed My Health', '[synthetic] What Nobody Tells You About Longevity'];
const SIM_CUT = ['[synthetic] The middle section felt long', '[synthetic] Too much detail on supplements'];

/** Structured feedback for a synthetic viewer, shaped like the real questionnaire. */
function syntheticFeedback(test: TestRow, r: () => number, likesIt: number): Feedback {
  const pickOne = <T>(list: T[]) => list[Math.floor(r() * list.length)];
  const scale5 = () => Math.min(5, Math.max(1, Math.round(2.6 + likesIt * 2.4 + (r() - 0.5) * 1.6)));
  const lines = test.transcript.length ? Array.from({ length: 1 + Math.floor(r() * 3) }, () => Math.floor(Math.pow(r(), 2) * test.transcript.length)) : [];
  const f: Feedback = {
    feeling: scale5(),
    relevance: scale5(),
    liked: likesIt > 0.75 ? 'loved' : likesIt > 0.5 ? 'liked' : likesIt > 0.3 ? 'okay' : 'not_for_me',
    recommend: Math.min(10, Math.max(0, Math.round(4 + likesIt * 6 + (r() - 0.5) * 3))),
    standoutLines: lines.length ? [...new Set(lines)] : undefined,
    standoutWhy: r() < 0.6 ? pickOne(SIM_WHY) : undefined,
    oneLiner: r() < 0.5 ? pickOne(SIM_ONE_LINER) : undefined,
    titleIdea: r() < 0.4 ? pickOne(SIM_TITLES) : undefined,
    wouldCut: r() < 0.3 ? pickOne(SIM_CUT) : undefined,
  };
  if (test.config.survey.length) {
    f.custom = Object.fromEntries(test.config.survey.map((q) => [q.id, q.kind === 'scale' ? 5 + Math.round(r() * 5) : q.kind === 'yesno' ? (r() < 0.6 ? 'yes' : 'no') : null]));
  }
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as Feedback;
}

export function simulatePanel(store: Store, test: TestRow, cut: CutRow, viewers: number, seed = `${Date.now()}`): number {
  const duration = cut.resolved?.durationSec ?? 0;
  if (duration <= 0) return 0;
  const range = rangeFor(test.config, duration);
  const start = Math.floor(range.start);
  const end = Math.floor(range.end);
  const span = end - start;
  const story = storyFor(cut.id, start, end);
  const r = rng(`panel:${cut.id}:${seed}`);

  const secStmt = store.db.prepare('INSERT OR REPLACE INTO session_seconds (session_id, sec, samples, face, attentive) VALUES (?, ?, 4, ?, ?)');
  const evStmt = store.db.prepare('INSERT INTO events (session_id, type, pt, ts, data) VALUES (?, ?, ?, ?, NULL)');
  let created = 0;

  for (let v = 0; v < viewers; v++) {
    const age = pick(r, AGE);
    const demographics = { age_band: age, gender: pick(r, GENDER), country: pick(r, COUNTRY), member: pick(r, MEMBER) };
    const session = store.createSession({ testId: test.id, cutId: cut.id, pid: newId('sim'), demographics, synthetic: true, status: 'watching' });
    const offset = (r() - 0.5) * 0.14;
    const calibFails = r() < 0.03;
    const hidesFace = r() < 0.03;
    const failsChecks = r() < 0.03;
    // Most viewers finish; the rest leave at a random point, earlier leavers more likely.
    const leaveAt = r() < 0.78 ? end : start + Math.floor(span * Math.pow(r(), 0.7));
    const now = Date.now();

    store.tx(() => {
      for (let t = start; t < leaveAt; t++) {
        let p = 0.9 - 0.1 * ((t - start) / span) + offset;
        for (const d of story.dips) if (t >= d.start && t < d.start + d.len) p -= d.depth * (age === d.ageBias ? 1.5 : 1);
        for (const k of story.peaks) if (Math.abs(t - k.at) < k.width) p += 0.06;
        p = Math.min(0.99, Math.max(0.02, p));
        let att = 0;
        for (let i = 0; i < 4; i++) if (r() < p) att++;
        const face = hidesFace ? (r() < 0.3 ? 4 : 0) : Math.max(att, r() < 0.95 ? 4 : 2);
        secStmt.run(session.id, t, face, hidesFace ? 0 : att);
        if (r() < 0.0015) evStmt.run(session.id, 'interest', t + r(), now);
        for (const d of story.dips) if (t >= d.start && t < d.start + d.len && r() < 0.0015) evStmt.run(session.id, 'bored', t + r(), now);
      }
      for (const k of story.peaks) {
        if (k.at >= leaveAt) continue;
        const chance = k.strength * (age === k.ageBias ? 1.8 : 1);
        if (r() < chance) evStmt.run(session.id, 'interest', k.at + (r() - 0.5) * k.width, now);
      }
    });

    const checks = test.config.attentionChecks;
    const passed = failsChecks ? 0 : checks;
    const finished = leaveAt >= end;
    // Most finishers fill in the questionnaire; some are still "to do", as with real panels.
    const gaveFeedback = finished && r() < 0.85;
    store.updateSession(session.id, {
      status: finished ? (gaveFeedback ? 'completed' : 'watched') : 'abandoned',
      calib_passed: calibFails ? 0 : 1,
      max_pt: leaveAt,
      checks_total: checks,
      checks_passed: passed,
      pauses: Math.floor(r() * 3),
      completed_at: gaveFeedback ? now : null,
      feedback_at: gaveFeedback ? now : null,
      survey: gaveFeedback ? JSON.stringify(syntheticFeedback(test, r, Math.min(1, Math.max(0, 0.65 + offset * 3 + (r() - 0.5) * 0.5)))) : null,
    });
    evaluateSession(store, store.getSession(session.id)!, test.config, duration);
    created++;
  }
  return created;
}
