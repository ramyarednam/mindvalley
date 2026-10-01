import type { Store } from './db.ts';
import type { SessionRow, TestConfig } from './types.ts';

/** Quality thresholds (PRD SQ-5). */
export const QUALITY = {
  minFaceShare: 0.5,
  minCheckPassShare: 2 / 3,
  /** More than one press every 3 s on average looks like key mashing or a bot. */
  maxPressesPerSec: 1 / 3,
  /** Viewers can save and come back for a week before an unfinished session counts as abandoned. */
  abandonAfterMs: 7 * 24 * 3600 * 1000,
};

export type QualityInput = {
  calibPassed: boolean;
  watchedSec: number;
  rangeSec: number;
  samples: number;
  face: number;
  presses: number;
  checksTotal: number;
  checksPassed: number;
};

/** Returns null when the session is valid, else the first reason it is excluded. */
export function excludeReason(q: QualityInput, minWatchPct: number): string | null {
  if (!q.calibPassed) return 'calibration_failed';
  if (q.rangeSec > 0 && q.watchedSec / q.rangeSec < minWatchPct) return 'watched_too_little';
  if (q.samples > 0 && q.face / q.samples < QUALITY.minFaceShare) return 'face_not_visible';
  if (q.checksTotal > 0 && q.checksPassed / q.checksTotal < QUALITY.minCheckPassShare) return 'failed_attention_checks';
  if (q.watchedSec > 0 && q.presses / q.watchedSec > QUALITY.maxPressesPerSec) return 'suspicious_key_pattern';
  return null;
}

export function rangeFor(cfg: TestConfig, durationSec: number): { start: number; end: number } {
  const start = Math.max(0, cfg.range?.start ?? 0);
  const end = Math.min(durationSec, cfg.range?.end ?? durationSec);
  return { start, end: end > start ? end : durationSec };
}

export function evaluateSession(store: Store, session: SessionRow, cfg: TestConfig, durationSec: number): string | null {
  const range = rangeFor(cfg, durationSec);
  const t = store.sessionSignalTotals(session.id, range);
  const reason = excludeReason(
    {
      calibPassed: session.calib_passed === 1,
      watchedSec: t.watchedSec,
      rangeSec: range.end - range.start,
      samples: t.samples,
      face: t.face,
      presses: t.presses,
      checksTotal: session.checks_total,
      checksPassed: session.checks_passed,
    },
    cfg.minWatchPct,
  );
  store.updateSession(session.id, { valid: reason ? 0 : 1, exclude_reason: reason });
  return reason;
}

/** Marks sessions idle for 7 days as abandoned and scores what they watched (PRD PX-8 resume window). */
export function sweepAbandoned(store: Store, testId: string, cfg: TestConfig, durationOf: (cutId: string) => number): void {
  const cutoff = Date.now() - QUALITY.abandonAfterMs;
  for (const s of store.listSessions(testId)) {
    if ((s.status === 'started' || s.status === 'watching') && s.last_seen < cutoff) {
      store.updateSession(s.id, { status: 'abandoned' });
      evaluateSession(store, { ...s, status: 'abandoned' }, cfg, durationOf(s.cut_id));
    }
  }
}
