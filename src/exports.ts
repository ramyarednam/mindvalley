import type { Moment } from './scoring.ts';

/** Timecode HH:MM:SS:FF at an integer frame rate (non-drop). */
export function timecode(sec: number, fps: number): string {
  const rate = Math.round(fps) || 25;
  const total = Math.max(0, Math.round(sec * rate));
  const ff = total % rate;
  const s = Math.floor(total / rate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}:${pad(ff)}`;
}

function label(m: Moment, i: number): string {
  return m.kind === 'peak' ? `Peak ${i + 1}: ${m.score} presses/100` : `Drop-off ${i + 1}: -${m.score} pts`;
}

function ordered(peaks: Moment[], dropoffs: Moment[]): { m: Moment; name: string }[] {
  return [...peaks.map((m, i) => ({ m, name: label(m, i) })), ...dropoffs.map((m, i) => ({ m, name: label(m, i) }))].sort((a, b) => a.m.start - b.m.start);
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(peaks: Moment[], dropoffs: Moment[], fps: number): string {
  const head = ['type', 'name', 'start_sec', 'end_sec', 'start_tc', 'end_tc', 'score', 'attention', 'transcript'];
  const rows = ordered(peaks, dropoffs).map(({ m, name }) =>
    [m.kind, name, m.start, m.end, timecode(m.start, fps), timecode(m.end, fps), m.score, m.attention === null ? null : Math.round(m.attention * 1000) / 10, m.transcript].map(csvCell).join(','),
  );
  return [head.join(','), ...rows].join('\n') + '\n';
}

/** CMX3600 EDL with marker comments; DaVinci Resolve imports these via "Import > Timeline Markers from EDL". */
export function toEdl(title: string, peaks: Moment[], dropoffs: Moment[], fps: number): string {
  const lines = [`TITLE: ${title.replace(/[^\x20-\x7e]/g, '').slice(0, 60)}`, 'FCM: NON-DROP FRAME', ''];
  ordered(peaks, dropoffs).forEach(({ m, name }, i) => {
    const tin = timecode(m.start, fps);
    const tout = timecode(m.start + 1 / fps, fps);
    const color = m.kind === 'peak' ? 'ResolveColorGreen' : 'ResolveColorRed';
    const dur = Math.max(1, Math.round((m.end - m.start) * Math.round(fps)));
    lines.push(`${String(i + 1).padStart(3, '0')}  001      V     C        ${tin} ${tout} ${tin} ${tout}`);
    lines.push(` |C:${color} |M:${name.replace(/\|/g, '/')} |D:${dur}`);
    lines.push('');
  });
  return lines.join('\n');
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Final Cut Pro 7 XML (xmeml) sequence carrying markers; Premiere Pro imports it via File > Import. */
export function toPremiereXml(title: string, durationSec: number, peaks: Moment[], dropoffs: Moment[], fps: number): string {
  const rate = Math.round(fps) || 25;
  const frames = (s: number) => Math.round(s * rate);
  const markers = ordered(peaks, dropoffs)
    .map(
      ({ m, name }) => `      <marker>
        <name>${xml(name)}</name>
        <comment>${xml(m.transcript)}</comment>
        <in>${frames(m.start)}</in>
        <out>${frames(m.end)}</out>
      </marker>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="prewatch-markers">
    <name>${xml(`${title} - Pre-Watch markers`)}</name>
    <duration>${frames(durationSec)}</duration>
    <rate><timebase>${rate}</timebase><ntsc>FALSE</ntsc></rate>
    <timecode><rate><timebase>${rate}</timebase><ntsc>FALSE</ntsc></rate><string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>
${markers}
    <media><video><format><samplecharacteristics><rate><timebase>${rate}</timebase></rate><width>1920</width><height>1080</height></samplecharacteristics></format><track/></video><audio><track/></audio></media>
  </sequence>
</xmeml>
`;
}
