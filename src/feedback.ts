import type { Cue, Feedback, Liked, SessionRow, SurveyQuestion } from './types.ts';

export const LIKED: Liked[] = ['loved', 'liked', 'okay', 'not_for_me'];
export const MAX_STANDOUT_LINES = 5;

const str = (v: unknown, max: number): string | undefined => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || undefined;
};
const int = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isInteger(n) && n >= lo && n <= hi ? n : undefined;
};

/** Cleans a (possibly partial) questionnaire from the browser. Unknown or invalid fields are dropped. */
export function normalizeFeedback(input: unknown, opts: { cueCount: number; custom: SurveyQuestion[] }): Feedback {
  const f = (input ?? {}) as Record<string, unknown>;
  const out: Feedback = {};
  out.feeling = int(f.feeling, 1, 5);
  out.relevance = int(f.relevance, 1, 5);
  out.liked = LIKED.includes(f.liked as Liked) ? (f.liked as Liked) : undefined;
  out.recommend = int(f.recommend, 0, 10);
  if (Array.isArray(f.standoutLines)) {
    const lines = [...new Set(f.standoutLines.map((i) => int(i, 0, Math.max(0, opts.cueCount - 1))).filter((i): i is number => i !== undefined))];
    if (lines.length && opts.cueCount) out.standoutLines = lines.slice(0, MAX_STANDOUT_LINES);
  }
  out.standoutWhy = str(f.standoutWhy, 1000);
  if (f.momentNotes && typeof f.momentNotes === 'object') {
    const notes = Object.entries(f.momentNotes as Record<string, unknown>)
      .slice(0, 20)
      .map(([k, v]) => [String(Math.round(Number(k))), str(v, 500)] as const)
      .filter(([k, v]) => v && Number.isFinite(Number(k)));
    if (notes.length) out.momentNotes = Object.fromEntries(notes) as Record<string, string>;
  }
  out.oneLiner = str(f.oneLiner, 300);
  out.titleIdea = str(f.titleIdea, 150);
  out.wouldCut = str(f.wouldCut, 1000);
  if (f.custom && typeof f.custom === 'object') {
    const c = f.custom as Record<string, unknown>;
    const custom: Record<string, string | number | null> = {};
    for (const q of opts.custom) {
      const v = c[q.id];
      if (q.kind === 'scale') custom[q.id] = int(v, 1, 10) ?? null;
      else if (q.kind === 'yesno') custom[q.id] = v === 'yes' || v === 'no' ? v : null;
      else custom[q.id] = str(v, 2000) ?? null;
    }
    out.custom = custom;
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Feedback;
}

export function parseFeedback(s: SessionRow): Feedback {
  if (!s.survey) return {};
  try {
    const raw = JSON.parse(s.survey) as Record<string, unknown>;
    // Sessions from the first release stored custom answers at the top level.
    if (!('custom' in raw) && !('feeling' in raw) && !('relevance' in raw)) return { custom: raw as Feedback['custom'] };
    return raw as Feedback;
  } catch {
    return {};
  }
}

function dist(values: number[], lo: number, hi: number): number[] {
  const out = new Array(hi - lo + 1).fill(0);
  for (const v of values) if (v >= lo && v <= hi) out[v - lo]++;
  return out;
}
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

type Who = { age_band: string | null; gender: string | null; country: string | null; member: string | null };
type Quote = { text: string; who: Who; at?: number };

function who(s: SessionRow): Who {
  return { age_band: s.age_band, gender: s.gender, country: s.country, member: s.member };
}

/** Aggregates every submitted questionnaire for one cut into the numbers and quotes the dashboards show. */
export function aggregateFeedback(sessions: SessionRow[], cues: Cue[], custom: SurveyQuestion[]) {
  const done = sessions.filter((s) => s.feedback_at || s.status === 'completed');
  const fb = done.map((s) => ({ s, f: parseFeedback(s) }));

  const feeling = fb.map((x) => x.f.feeling).filter((v): v is number => v !== undefined);
  const relevance = fb.map((x) => x.f.relevance).filter((v): v is number => v !== undefined);
  const recommend = fb.map((x) => x.f.recommend).filter((v): v is number => v !== undefined);
  const liked = Object.fromEntries(LIKED.map((k) => [k, fb.filter((x) => x.f.liked === k).length])) as Record<Liked, number>;
  const likedTotal = Object.values(liked).reduce((a, b) => a + b, 0);

  const promoters = recommend.filter((v) => v >= 9).length;
  const detractors = recommend.filter((v) => v <= 6).length;

  // Transcript lines viewers picked as standing out: the strongest hook candidates.
  const lineCounts = new Map<number, number>();
  for (const { f } of fb) for (const i of f.standoutLines ?? []) lineCounts.set(i, (lineCounts.get(i) ?? 0) + 1);
  const pickedBy = fb.filter((x) => x.f.standoutLines?.length).length;
  const standoutLines = [...lineCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .filter(([i]) => cues[i])
    .map(([i, n]) => ({ index: i, start: cues[i].start, end: cues[i].end, text: cues[i].text, count: n, share: pickedBy ? n / pickedBy : 0 }));

  const quotes = (pick: (f: Feedback) => string | undefined): Quote[] =>
    fb
      .map(({ s, f }) => ({ text: pick(f), who: who(s) }))
      .filter((q): q is Quote => !!q.text)
      .reverse();

  const momentNotes: Quote[] = [];
  for (const { s, f } of fb) for (const [at, text] of Object.entries(f.momentNotes ?? {})) momentNotes.push({ text, at: Number(at), who: who(s) });
  momentNotes.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  const customResults = custom.map((q) => {
    const vals = fb.map((x) => x.f.custom?.[q.id]).filter((v) => v !== undefined && v !== null && v !== '');
    if (q.kind === 'text') return { ...q, n: vals.length, responses: vals.map(String).reverse().slice(0, 300) };
    if (q.kind === 'yesno') return { ...q, n: vals.length, yesShare: vals.length ? vals.filter((v) => v === 'yes').length / vals.length : null };
    const nums = vals.map(Number).filter(Number.isFinite);
    return { ...q, n: nums.length, mean: mean(nums), distribution: dist(nums, 1, 10) };
  });

  return {
    responses: done.length,
    feeling: { mean: mean(feeling), distribution: dist(feeling, 1, 5), n: feeling.length },
    relevance: { mean: mean(relevance), distribution: dist(relevance, 1, 5), n: relevance.length, relevantShare: relevance.length ? relevance.filter((v) => v >= 4).length / relevance.length : null },
    liked: { counts: liked, n: likedTotal, likedShare: likedTotal ? (liked.loved + liked.liked) / likedTotal : null },
    recommend: { mean: mean(recommend), n: recommend.length, nps: recommend.length ? Math.round(((promoters - detractors) / recommend.length) * 100) : null, distribution: dist(recommend, 0, 10) },
    standoutLines,
    standoutWhy: quotes((f) => f.standoutWhy),
    momentNotes,
    oneLiners: quotes((f) => f.oneLiner),
    titleIdeas: quotes((f) => f.titleIdea),
    wouldCut: quotes((f) => f.wouldCut),
    custom: customResults,
  };
}

export type FeedbackSummary = ReturnType<typeof aggregateFeedback>;

const STOP = new Set('a an and are as at be been but by for from had has have he her his i if in into is it its just like me my no not of on or our she so that the their them then there they this to too up was we were what when which who will with you your really very more about also would could should some than its it\'s im i\'m dont don\'t'.split(' '));

/** Most frequent meaningful words across answers; a quick theme signal when no Claude summary is available. */
export function topWords(texts: string[], n = 12): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const seen = new Set<string>();
    // Bracketed tags such as "[synthetic]" are labels, not words viewers used.
    for (const w of t.replace(/\[[^\]]*\]/g, ' ').toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      if (STOP.has(w) || seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([word, count]) => ({ word, count }));
}
