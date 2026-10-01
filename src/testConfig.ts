import type { Store } from './db.ts';
import type { SurveyQuestion, TestConfig, TestRow } from './types.ts';
import { DEMOGRAPHIC_KEYS } from './types.ts';

/** Extra questions an admin adds after the built-in feedback flow. None by default. */
export function defaultConfig(): TestConfig {
  return { targetViewers: 1000, quotas: {}, survey: [], attentionChecks: 3, minWatchPct: 0.7, maxPauseSec: 900 };
}

export const str = (v: unknown, max = 500): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

export function normalizeConfig(input: unknown, base: TestConfig = defaultConfig()): TestConfig {
  const c = (input ?? {}) as Record<string, unknown>;
  const quotas: TestConfig['quotas'] = {};
  const rawQuotas = (c.quotas ?? base.quotas) as Record<string, Record<string, unknown>>;
  for (const key of DEMOGRAPHIC_KEYS) {
    const q = rawQuotas?.[key];
    if (!q || typeof q !== 'object') continue;
    const entries = Object.entries(q)
      .map(([k, v]) => [str(k, 60), num(v, 0, 1, 0)] as const)
      .filter(([k, v]) => k && v > 0);
    if (entries.length) quotas[key] = Object.fromEntries(entries);
  }
  const survey = Array.isArray(c.survey)
    ? (c.survey as Record<string, unknown>[])
        .slice(0, 5)
        .map((q, i) => ({ id: str(q.id, 40) || `q${i + 1}`, text: str(q.text, 300), kind: (['scale', 'yesno', 'text'].includes(q.kind as string) ? q.kind : 'text') as SurveyQuestion['kind'] }))
        .filter((q) => q.text)
    : base.survey;
  const range = c.range === null ? undefined : ((c.range ?? base.range) as { start?: unknown; end?: unknown } | undefined);
  const start = range ? num(range.start, 0, 1e6, 0) : 0;
  const end = range ? num(range.end, 0, 1e6, 0) : 0;
  const redirect = str(c.completionRedirect ?? base.completionRedirect, 1000);
  return {
    targetViewers: Math.round(num(c.targetViewers ?? base.targetViewers, 1, 100_000, 1000)),
    quotas,
    survey,
    attentionChecks: Math.round(num(c.attentionChecks ?? base.attentionChecks, 0, 10, 3)),
    minWatchPct: num(c.minWatchPct ?? base.minWatchPct, 0, 1, 0.7),
    maxPauseSec: Math.round(num(c.maxPauseSec ?? base.maxPauseSec, 0, 86_400, 900)),
    completionRedirect: /^https:\/\//.test(redirect) ? redirect : undefined,
    range: end > start ? { start, end } : undefined,
  };
}

/** Screens a new panelist against the test's size and quotas (PRD TS-3). */
export function screen(store: Store, test: TestRow, demographics: Record<string, string | null>): string | null {
  const active = [...store.sessionCountsByCut(test.id).values()].reduce((a, b) => a + b, 0);
  if (active >= test.config.targetViewers) return 'This screening is full. Thank you for your interest!';
  for (const key of DEMOGRAPHIC_KEYS) {
    const quota = test.config.quotas[key];
    if (!quota) continue;
    const value = demographics[key];
    if (!value || !(value in quota)) return 'This screening is looking for a different audience this time. Thank you for your interest!';
    const target = Math.ceil(quota[value] * test.config.targetViewers);
    if ((store.quotaCounts(test.id, key).get(value) ?? 0) >= target) return 'We already have enough viewers like you for this one. Thank you for your interest!';
  }
  return null;
}

/** Attention-check times spread over the watch range, never in the first minute (PRD PX-7). */
export function scheduleChecks(n: number, range: { start: number; end: number }): number[] {
  const span = range.end - range.start;
  if (n <= 0 || span < 120) return [];
  const slot = (span - 60) / n;
  return Array.from({ length: n }, (_, i) => Math.round(range.start + 60 + slot * i + Math.random() * slot * 0.8));
}
