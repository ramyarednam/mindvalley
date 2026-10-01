import type { Store } from './db.ts';
import type { Cue, CutRow, DemographicKey, TestRow } from './types.ts';
import { DEMOGRAPHIC_KEYS } from './types.ts';
import { rangeFor } from './quality.ts';
import { excerpt } from './transcript.ts';

/** Scoring parameters (PRD SQ-1 to SQ-4). */
export const SCORING = {
  interestWindowSec: 5,
  baselineWindowSec: 300,
  dropThreshold: 0.1,
  dropMinSec: 20,
  /** Drop-offs are found on attention smoothed over this window, so per-second noise cannot split a dip. */
  dropSmoothSec: 9,
  /** A dip survives brief recoveries of up to this many seconds. */
  dropToleranceSec: 5,
  peakTopShare: 0.05,
  /** A peak needs at least this many presses per 100 viewers in its 5 s window. */
  peakMinInterest: 1,
  mergeGapSec: 3,
  topN: 10,
};

export type Curve = {
  start: number;
  /** Values per second from `start`; null where nobody was watching. */
  attention: (number | null)[];
  ciLow: (number | null)[];
  ciHigh: (number | null)[];
  viewers: number[];
  retention: number[];
  interest: number[];
  bored: number[];
  baseline: (number | null)[];
};

export type Moment = {
  start: number;
  end: number;
  at: number;
  kind: 'dropoff' | 'peak';
  /** Drop-off: points below baseline (0-100). Peak: presses per 100 viewers. */
  score: number;
  attention: number | null;
  transcript: string;
};

// ---------- pure analysis ----------

export function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  const half = Math.floor(window / 2);
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  let count = 0;
  const add = (v: number | null, sign: 1 | -1) => {
    if (v === null) return;
    sum += sign * v;
    count += sign;
  };
  for (let i = 0; i < Math.min(half, values.length); i++) add(values[i], 1);
  for (let i = 0; i < values.length; i++) {
    if (i + half < values.length) add(values[i + half], 1);
    if (i - half - 1 >= 0) add(values[i - half - 1], -1);
    out[i] = count > 0 && values[i] !== null ? sum / count : null;
  }
  return out;
}

/** Runs where attention sits `threshold` below baseline for at least `minLen` seconds, tolerating brief recoveries. */
export function findDropoffs(attention: (number | null)[], baseline: (number | null)[], start: number, threshold = SCORING.dropThreshold, minLen = SCORING.dropMinSec, tolerance = SCORING.dropToleranceSec): Omit<Moment, 'transcript'>[] {
  const out: Omit<Moment, 'transcript'>[] = [];
  let runStart = -1;
  let lastBelow = -1;
  let area = 0;
  let worst = 0;
  let worstAt = 0;
  const close = () => {
    const end = lastBelow + 1;
    if (runStart >= 0 && end - runStart >= minLen) {
      out.push({ start: start + runStart, end: start + end, at: start + worstAt, kind: 'dropoff', score: Math.round((area / (end - runStart)) * 1000) / 10, attention: attention[worstAt] });
    }
    runStart = -1;
    area = 0;
    worst = 0;
  };
  for (let i = 0; i < attention.length; i++) {
    const a = attention[i];
    const b = baseline[i];
    const gap = a !== null && b !== null ? b - a : 0;
    if (gap >= threshold) {
      if (runStart < 0) runStart = i;
      lastBelow = i;
      area += gap;
      if (gap > worst) {
        worst = gap;
        worstAt = i;
      }
    } else if (runStart >= 0 && i - lastBelow > tolerance) close();
  }
  if (runStart >= 0) close();
  // Deepest and longest first.
  return out.sort((x, y) => y.score * (y.end - y.start) - x.score * (x.end - x.start));
}

/** Seconds in the top share of interest, merged into moments and ranked by their highest point. */
export function findPeaks(interest: number[], attention: (number | null)[], start: number, topShare = SCORING.peakTopShare, minInterest = SCORING.peakMinInterest, mergeGap = SCORING.mergeGapSec): Omit<Moment, 'transcript'>[] {
  const positive = interest.filter((v) => v > 0).sort((a, b) => b - a);
  if (!positive.length) return [];
  const cutoff = Math.max(minInterest, positive[Math.max(0, Math.ceil(interest.length * topShare) - 1)] ?? positive.at(-1)!);
  const out: Omit<Moment, 'transcript'>[] = [];
  let cur: { s: number; e: number; best: number; at: number } | null = null;
  for (let i = 0; i < interest.length; i++) {
    if (interest[i] >= cutoff) {
      if (cur && i - cur.e <= mergeGap) {
        cur.e = i;
        if (interest[i] > cur.best) {
          cur.best = interest[i];
          cur.at = i;
        }
      } else {
        if (cur) out.push(toPeak(cur));
        cur = { s: i, e: i, best: interest[i], at: i };
      }
    }
  }
  if (cur) out.push(toPeak(cur));
  function toPeak(c: { s: number; e: number; best: number; at: number }): Omit<Moment, 'transcript'> {
    return { start: start + c.s, end: start + c.e + 1, at: start + c.at, kind: 'peak', score: Math.round(c.best * 10) / 10, attention: attention[c.at] };
  }
  return out.sort((a, b) => b.score - a.score);
}

export function meanCi(n: number, mean: number, meanSq: number): [number, number] {
  if (n < 2) return [mean, mean];
  const variance = Math.max(0, (meanSq - mean * mean) * (n / (n - 1)));
  const half = 1.96 * Math.sqrt(variance / n);
  return [Math.max(0, mean - half), Math.min(1, mean + half)];
}

/** Presses per 100 viewers inside a centred window. */
export function interestCurve(presses: number[], viewers: number[], window = SCORING.interestWindowSec): number[] {
  const half = Math.floor(window / 2);
  return presses.map((_, i) => {
    let sum = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(presses.length - 1, i + half); j++) sum += presses[j];
    return viewers[i] > 0 ? Math.round((1000 * sum) / viewers[i]) / 10 : 0;
  });
}

// ---------- data access ----------

type SecRow = { sec: number; n: number; m: number; m2: number };

function validFilter(includeSynthetic: boolean): string {
  return `s.cut_id = ? AND s.valid = 1${includeSynthetic ? '' : ' AND s.synthetic = 0'}`;
}

export function buildCurve(store: Store, cutId: string, range: { start: number; end: number }, includeSynthetic: boolean, segment?: { key: DemographicKey; value: string }): { curve: Curve; validViewers: number } {
  const len = Math.max(1, Math.ceil(range.end - range.start));
  const segSql = segment ? ` AND s.${segment.key} = ?` : '';
  const segArgs = segment ? [segment.value] : [];
  const where = validFilter(includeSynthetic) + segSql;

  const validViewers = (store.db.prepare(`SELECT COUNT(*) AS n FROM sessions s WHERE ${where}`).get(cutId, ...segArgs) as { n: number }).n;

  const rows = store.db
    .prepare(
      `SELECT ss.sec AS sec, COUNT(*) AS n,
              AVG(1.0 * ss.attentive / ss.samples) AS m,
              AVG((1.0 * ss.attentive / ss.samples) * (1.0 * ss.attentive / ss.samples)) AS m2
       FROM session_seconds ss JOIN sessions s ON s.id = ss.session_id
       WHERE ${where} AND ss.sec >= ? AND ss.sec < ? AND ss.samples > 0
       GROUP BY ss.sec`,
    )
    .all(cutId, ...segArgs, Math.floor(range.start), Math.floor(range.start) + len) as SecRow[];

  const ev = store.db
    .prepare(
      `SELECT CAST(e.pt AS INTEGER) AS sec, e.type AS type, COUNT(*) AS n
       FROM events e JOIN sessions s ON s.id = e.session_id
       WHERE ${where} AND e.type IN ('interest', 'bored') AND e.pt >= ? AND e.pt < ?
       GROUP BY sec, e.type`,
    )
    .all(cutId, ...segArgs, range.start, range.end) as { sec: number; type: string; n: number }[];

  const start = Math.floor(range.start);
  const attention: (number | null)[] = new Array(len).fill(null);
  const ciLow: (number | null)[] = new Array(len).fill(null);
  const ciHigh: (number | null)[] = new Array(len).fill(null);
  const viewers: number[] = new Array(len).fill(0);
  for (const r of rows) {
    const i = r.sec - start;
    if (i < 0 || i >= len) continue;
    attention[i] = r.m;
    viewers[i] = r.n;
    [ciLow[i], ciHigh[i]] = meanCi(r.n, r.m, r.m2);
  }
  const presses: number[] = new Array(len).fill(0);
  const boredPresses: number[] = new Array(len).fill(0);
  for (const e of ev) {
    const i = e.sec - start;
    if (i < 0 || i >= len) continue;
    (e.type === 'interest' ? presses : boredPresses)[i] += e.n;
  }
  const retention = viewers.map((n) => (validViewers ? Math.round((1000 * n) / validViewers) / 1000 : 0));
  const curve: Curve = {
    start,
    attention,
    ciLow,
    ciHigh,
    viewers,
    retention,
    interest: interestCurve(presses, viewers),
    bored: interestCurve(boredPresses, viewers),
    baseline: movingAverage(attention, SCORING.baselineWindowSec),
  };
  return { curve, validViewers };
}

function withTranscript(moments: Omit<Moment, 'transcript'>[], cues: Cue[]): Moment[] {
  return moments.slice(0, SCORING.topN).map((m) => ({ ...m, transcript: excerpt(cues, m.start, m.end) }));
}

export function buildReport(store: Store, test: TestRow, cut: CutRow, opts: { includeSynthetic: boolean; segmentKey?: DemographicKey; minSegmentViewers: number }) {
  const duration = cut.resolved?.durationSec ?? 0;
  const range = rangeFor(test.config, duration);
  const all = store.listSessions(test.id).filter((s) => s.cut_id === cut.id && (opts.includeSynthetic || !s.synthetic));
  const valid = all.filter((s) => s.valid === 1);

  const excluded: Record<string, number> = {};
  for (const s of all) if (s.valid === 0 && s.exclude_reason) excluded[s.exclude_reason] = (excluded[s.exclude_reason] ?? 0) + 1;

  const { curve, validViewers } = buildCurve(store, cut.id, range, opts.includeSynthetic);
  const dropoffs = withTranscript(findDropoffs(movingAverage(curve.attention, SCORING.dropSmoothSec), curve.baseline, curve.start), test.transcript);
  const peaks = withTranscript(findPeaks(curve.interest, curve.attention, curve.start), test.transcript);

  const att = curve.attention.filter((v): v is number => v !== null);
  const summary = {
    avgAttention: att.length ? att.reduce((a, b) => a + b, 0) / att.length : null,
    retentionAtEnd: curve.retention.at(-1) ?? 0,
    retentionAt30s: curve.retention[Math.min(30, curve.retention.length - 1)] ?? 0,
    interestPresses: (store.db.prepare(`SELECT COUNT(*) AS n FROM events e JOIN sessions s ON s.id = e.session_id WHERE ${validFilter(opts.includeSynthetic)} AND e.type = 'interest'`).get(cut.id) as { n: number }).n,
  };

  const segments: { key: DemographicKey; options: { value: string; n: number; hidden: boolean; attention?: (number | null)[] }[] }[] = [];
  const keys = opts.segmentKey ? [opts.segmentKey] : DEMOGRAPHIC_KEYS;
  for (const key of keys) {
    const counts = new Map<string, number>();
    for (const s of valid) {
      const v = s[key];
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const options = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, n]) => {
        const hidden = n < opts.minSegmentViewers;
        // Only compute curves for the requested key to keep the report cheap.
        const attention = !hidden && opts.segmentKey === key ? buildCurve(store, cut.id, range, opts.includeSynthetic, { key, value }).curve.attention : undefined;
        return { value, n, hidden, attention };
      });
    segments.push({ key, options });
  }

  return {
    test: { id: test.id, title: test.title, status: test.status, targetViewers: test.config.targetViewers },
    cut: { id: cut.id, label: cut.label, name: cut.resolved?.name, durationSec: duration, fps: cut.resolved?.fps ?? 25 },
    range,
    generatedAt: Date.now(),
    panel: {
      sessions: all.length,
      completed: all.filter((s) => s.status === 'completed').length,
      inProgress: all.filter((s) => s.status === 'started' || s.status === 'watching').length,
      awaitingFeedback: all.filter((s) => s.status === 'watched').length,
      screenedOut: all.filter((s) => s.status === 'screened_out').length,
      valid: validViewers,
      excluded,
      synthetic: all.filter((s) => s.synthetic).length,
    },
    summary,
    curve,
    dropoffs,
    peaks,
    segments,
  };
}

export type Report = ReturnType<typeof buildReport>;
