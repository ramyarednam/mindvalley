import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { FeedbackSummary } from './feedback.ts';
import { topWords } from './feedback.ts';
import type { Report } from './scoring.ts';

/** One shape for both summary sources, so the dashboard renders them the same way. */
export const SummarySchema = z.object({
  headline: z.string().describe('One sentence verdict for the team, with the key number.'),
  verdict: z.enum(['strong', 'mixed', 'weak']),
  keyFindings: z.array(z.string()).describe('3 to 6 short findings, each with a number.'),
  whatWorked: z.array(z.string()).describe('Moments and qualities viewers responded to, with timestamps where known.'),
  whatToFix: z.array(z.string()).describe('Concrete edit suggestions: what to cut, tighten or move, with timestamps.'),
  hookCandidates: z
    .array(z.object({ quote: z.string(), timestamp: z.number().describe('Seconds from the start of the episode'), why: z.string() }))
    .describe('Lines or moments that would work as the cold open, a short, or thumbnail text.'),
  titleIdeas: z.array(z.string()).describe('YouTube title ideas grounded in what viewers said stood out.'),
  thumbnailIdeas: z.array(z.string()).describe('Thumbnail text or concept ideas.'),
  audienceNotes: z.string().describe('How reactions differed across audience groups, or that they did not.'),
});
export type Summary = z.infer<typeof SummarySchema>;

const pct = (v: number | null | undefined) => (v === null || v === undefined ? 'n/a' : `${Math.round(v * 100)}%`);
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Rule-based summary built only from the numbers; always available, no API key needed. */
export function autoSummary(report: Report, fb: FeedbackSummary): Summary {
  const att = report.summary.avgAttention;
  const likedShare = fb.liked.likedShare;
  const relevant = fb.relevance.relevantShare;
  const verdict: Summary['verdict'] =
    (likedShare ?? 0.7) >= 0.7 && (att ?? 0) >= 0.8 ? 'strong' : (likedShare !== null && likedShare < 0.45) || (att !== null && att < 0.6) ? 'weak' : 'mixed';

  const headline =
    fb.responses > 0
      ? `${verdict === 'strong' ? 'Strong episode' : verdict === 'weak' ? 'Needs work' : 'Mixed reaction'}: ${pct(likedShare)} liked it and average attention was ${pct(att)}.`
      : report.panel.valid > 0
        ? `Average attention was ${pct(att)} across ${report.panel.valid} viewers; no written feedback yet.`
        : 'No viewer data yet.';

  const keyFindings: string[] = [];
  if (report.panel.valid) {
    keyFindings.push(`${pct(report.summary.retentionAt30s)} were still watching at 30 seconds and ${pct(report.summary.retentionAtEnd)} at the end.`);
    keyFindings.push(`Average attention: ${pct(att)} of viewers looking at the screen.`);
  }
  if (relevant !== null) keyFindings.push(`${pct(relevant)} rated the topic relevant to them (4 or 5 out of 5).`);
  if (fb.recommend.nps !== null) keyFindings.push(`Recommendation score (NPS): ${fb.recommend.nps > 0 ? '+' : ''}${fb.recommend.nps} from ${fb.recommend.n} answers.`);
  if (report.peaks[0]) keyFindings.push(`Strongest moment at ${clock(report.peaks[0].start)}: ${report.peaks[0].score} spacebar presses per 100 viewers.`);
  if (report.dropoffs[0]) keyFindings.push(`Biggest drop: ${clock(report.dropoffs[0].start)} to ${clock(report.dropoffs[0].end)}, ${report.dropoffs[0].score} points below normal.`);

  const whatWorked = report.peaks.slice(0, 3).map((p) => `${clock(p.start)}${p.transcript ? `: "${p.transcript}"` : ''} (${p.score} presses per 100 viewers)`);
  const liked = topWords(fb.standoutWhy.map((q) => q.text), 6);
  if (liked.length) whatWorked.push(`Words viewers used most about what stood out: ${liked.map((w) => w.word).join(', ')}.`);

  const whatToFix = report.dropoffs.slice(0, 3).map((d) => `Tighten ${clock(d.start)} to ${clock(d.end)}: attention fell to ${pct(d.attention)}${d.transcript ? ` during "${d.transcript.slice(0, 120)}"` : ''}.`);
  const cut = topWords(fb.wouldCut.map((q) => q.text), 6);
  if (cut.length) whatToFix.push(`When asked what they would cut, viewers mentioned: ${cut.map((w) => w.word).join(', ')}.`);

  const hookCandidates = fb.standoutLines.length
    ? fb.standoutLines.slice(0, 5).map((l) => ({ quote: l.text, timestamp: l.start, why: `Picked as a standout line by ${pct(l.share)} of viewers who chose lines.` }))
    : report.peaks.slice(0, 5).map((p) => ({ quote: p.transcript, timestamp: p.start, why: `${p.score} spacebar presses per 100 viewers.${p.transcript ? '' : ' Upload a transcript to see what was said here.'}` }));

  const titleIdeas = [...new Set(fb.titleIdeas.map((q) => q.text))].slice(0, 8);

  return {
    headline,
    verdict,
    keyFindings,
    whatWorked,
    whatToFix,
    hookCandidates,
    titleIdeas,
    thumbnailIdeas: hookCandidates.filter((h) => h.quote).slice(0, 3).map((h) => h.quote.split(/[.!?]/)[0].slice(0, 60)),
    audienceNotes: 'Open the Audience tab to compare attention by age, gender, country and member status.',
  };
}

const SAMPLE_PER_FIELD = 150;
const MAX_ANSWER_CHARS = 400;

function sample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

/** Builds the data Claude reads. Long answer lists are evenly sampled, and the prompt states the sample sizes. */
export function summaryInput(title: string, description: string, report: Report, fb: FeedbackSummary) {
  const texts = (list: { text: string }[]) => ({ total: list.length, sample: sample(list, SAMPLE_PER_FIELD).map((q) => q.text.slice(0, MAX_ANSWER_CHARS)) });
  return {
    episode: { title, description, cut: report.cut.label, lengthSec: report.range.end - report.range.start },
    panel: { validViewers: report.panel.valid, responses: fb.responses, syntheticViewers: report.panel.synthetic },
    attention: { average: report.summary.avgAttention, watchingAt30s: report.summary.retentionAt30s, watchingAtEnd: report.summary.retentionAtEnd },
    peaks: report.peaks.map((p) => ({ start: p.start, end: p.end, pressesPer100: p.score, transcript: p.transcript })),
    dropoffs: report.dropoffs.map((d) => ({ start: d.start, end: d.end, pointsBelowBaseline: d.score, attention: d.attention, transcript: d.transcript })),
    ratings: { feeling1to5: fb.feeling, relevance1to5: fb.relevance, liked: fb.liked, recommend0to10: { mean: fb.recommend.mean, nps: fb.recommend.nps } },
    standoutLines: fb.standoutLines.map((l) => ({ start: l.start, text: l.text, pickedBy: l.count })),
    answers: {
      whyItStoodOut: texts(fb.standoutWhy),
      notesOnMarkedMoments: texts(fb.momentNotes),
      describeToAFriend: texts(fb.oneLiners),
      titleTheyWouldClick: texts(fb.titleIdeas),
      whatTheyWouldCut: texts(fb.wouldCut),
    },
  };
}

const SYSTEM = `You analyse pre-release screening data for long-form video episodes (podcasts, masterclasses) for an editorial and YouTube packaging team.
You receive attention data measured second by second while a panel watched the uncut episode, spacebar "interesting" presses, ratings, transcript lines viewers chose as standing out, and their written answers.
Write for editors and growth marketers who will act on it today: specific, short, with timestamps (in seconds in the timestamp fields; as m:ss in prose) and numbers.
Ground every claim in the data provided. Quote viewers only from the answers given. Where answer lists were sampled, the totals are given; treat the sample as representative.
If syntheticViewers is above zero, the data is partly simulated: say so in the headline.
If there are too few responses to support a point, say that rather than guessing.`;

export function claudeAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Asks Claude for a structured summary. Returns null when Claude declines or the output cannot be parsed. */
export async function claudeSummary(input: ReturnType<typeof summaryInput>, client = new Anthropic()): Promise<Summary | null> {
  const response = await client.messages.parse({
    model: process.env.SUMMARY_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: zodOutputFormat(SummarySchema) },
    messages: [{ role: 'user', content: `Summarise this screening for the team.\n\n${JSON.stringify(input)}` }],
  });
  if (response.stop_reason === 'refusal') return null;
  return response.parsed_output ?? null;
}
