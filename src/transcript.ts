import type { Cue } from './types.ts';

function toSec(ts: string): number {
  const m = ts.trim().replace(',', '.').match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return NaN;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Parses SRT or WebVTT text into cues. Unknown lines are ignored. */
export function parseTranscript(text: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim());
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx < 0) continue;
    const [a, b] = lines[timeIdx].split('-->');
    const start = toSec(a);
    const end = toSec(b.trim().split(/\s+/)[0]);
    const body = lines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && body) cues.push({ start, end, text: body });
  }
  return cues.sort((x, y) => x.start - y.start);
}

export function excerpt(cues: Cue[], start: number, end: number, maxLen = 220): string {
  const text = cues
    .filter((c) => c.end > start && c.start < end)
    .map((c) => c.text)
    .join(' ');
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}
