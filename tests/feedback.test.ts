import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Anthropic from '@anthropic-ai/sdk';
import { normalizeFeedback, topWords } from '../src/feedback.ts';
import { claudeSummary, SummarySchema } from '../src/summary.ts';

test('normalizeFeedback keeps valid answers and drops the rest', () => {
  const f = normalizeFeedback(
    { feeling: 9, relevance: '4', liked: 'adored', recommend: 0, standoutLines: [1, 1, 99, 'x', 0], oneLiner: '  hi  ', momentNotes: { '12.4': 'wow', abc: 'no', '20': '' }, custom: { q1: 'yes', q2: 'maybe' } },
    { cueCount: 3, custom: [{ id: 'q1', text: 'A?', kind: 'yesno' }, { id: 'q2', text: 'B?', kind: 'yesno' }] },
  );
  assert.equal(f.feeling, undefined, 'out of range');
  assert.equal(f.relevance, 4);
  assert.equal(f.liked, undefined);
  assert.equal(f.recommend, 0, 'zero is a valid score');
  assert.deepEqual(f.standoutLines, [1, 0]);
  assert.equal(f.oneLiner, 'hi');
  assert.deepEqual(f.momentNotes, { '12': 'wow' });
  assert.deepEqual(f.custom, { q1: 'yes', q2: null });
});

test('topWords counts each word once per answer and skips filler', () => {
  const words = topWords(['The sleep part was great, sleep sleep', 'Loved the sleep science', 'science!']);
  assert.deepEqual(words.slice(0, 2), [{ word: 'sleep', count: 2 }, { word: 'science', count: 2 }]);
});

const sample = SummarySchema.parse({
  headline: 'Strong',
  verdict: 'strong',
  keyFindings: ['a'],
  whatWorked: [],
  whatToFix: [],
  hookCandidates: [{ quote: 'q', timestamp: 10, why: 'w' }],
  titleIdeas: [],
  thumbnailIdeas: [],
  audienceNotes: '',
});

function fakeClient(response: object, seen: unknown[] = []) {
  return { messages: { parse: async (req: unknown) => (seen.push(req), response) } } as unknown as Anthropic;
}

test('claudeSummary sends a structured request and returns the parsed summary', async () => {
  const seen: Record<string, unknown>[] = [];
  const out = await claudeSummary({ episode: { title: 'T' } } as never, fakeClient({ stop_reason: 'end_turn', parsed_output: sample }, seen));
  assert.deepEqual(out, sample);
  assert.equal(seen[0].model, 'claude-opus-5-5');
  assert.equal((seen[0].output_config as { effort: string }).effort, 'medium');
});

test('claudeSummary returns null on a refusal so the automatic summary is used', async () => {
  assert.equal(await claudeSummary({} as never, fakeClient({ stop_reason: 'refusal', parsed_output: null })), null);
});
