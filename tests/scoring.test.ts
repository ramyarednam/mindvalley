import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDropoffs, findPeaks, interestCurve, meanCi, movingAverage } from '../src/scoring.ts';
import { excludeReason } from '../src/quality.ts';
import { parseTranscript, excerpt } from '../src/transcript.ts';
import { timecode, toCsv, toEdl, toPremiereXml } from '../src/exports.ts';
import { rewritePlaylist, decodeProxied } from '../src/hlsProxy.ts';
import { extractClientAuth, parseReplayResponse, parseReplayToken } from '../src/sources/dropboxReplay.ts';

test('movingAverage skips nulls and keeps gaps', () => {
  assert.deepEqual(movingAverage([1, 1, null, 3, 3], 3), [1, 1, null, 3, 3]);
  const out = movingAverage([0, 1, 0, 1], 3);
  assert.equal(out[1], 1 / 3);
});

test('findDropoffs flags a 30 s dip and ignores a 10 s one', () => {
  const att: number[] = new Array(300).fill(0.8);
  for (let i = 100; i < 130; i++) att[i] = 0.5;
  for (let i = 200; i < 210; i++) att[i] = 0.4;
  const base = new Array(300).fill(0.8);
  const drops = findDropoffs(att, base, 60);
  assert.equal(drops.length, 1);
  assert.equal(drops[0].start, 160);
  assert.equal(drops[0].end, 190);
  assert.equal(drops[0].score, 30);
});

test('findPeaks merges close seconds and ranks by height', () => {
  const interest = new Array(200).fill(0);
  interest[50] = 10;
  interest[52] = 12;
  interest[150] = 30;
  const peaks = findPeaks(interest, new Array(200).fill(0.9), 0, 0.05, 1, 3);
  assert.equal(peaks.length, 2);
  assert.equal(peaks[0].at, 150);
  assert.equal(peaks[1].start, 50);
  assert.equal(peaks[1].end, 53);
});

test('interestCurve is presses per 100 viewers in a 5 s window', () => {
  const presses = [0, 0, 5, 0, 0];
  const viewers = [100, 100, 100, 100, 100];
  assert.deepEqual(interestCurve(presses, viewers, 5), [5, 5, 5, 5, 5]);
});

test('meanCi narrows with more viewers', () => {
  const [lo1, hi1] = meanCi(10, 0.5, 0.35);
  const [lo2, hi2] = meanCi(1000, 0.5, 0.35);
  assert.ok(hi1 - lo1 > hi2 - lo2);
});

test('quality rules exclude in PRD order', () => {
  const ok = { calibPassed: true, watchedSec: 900, rangeSec: 1000, samples: 3600, face: 3500, presses: 20, checksTotal: 3, checksPassed: 3 };
  assert.equal(excludeReason(ok, 0.7), null);
  assert.equal(excludeReason({ ...ok, calibPassed: false }, 0.7), 'calibration_failed');
  assert.equal(excludeReason({ ...ok, watchedSec: 500 }, 0.7), 'watched_too_little');
  assert.equal(excludeReason({ ...ok, face: 100 }, 0.7), 'face_not_visible');
  assert.equal(excludeReason({ ...ok, checksPassed: 1 }, 0.7), 'failed_attention_checks');
  assert.equal(excludeReason({ ...ok, presses: 500 }, 0.7), 'suspicious_key_pattern');
});

test('parseTranscript reads SRT and VTT', () => {
  const srt = '1\n00:00:01,000 --> 00:00:04,000\nHello there\n\n2\n00:01:00,500 --> 00:01:03,000\n<i>Second</i> line\n';
  const cues = parseTranscript(srt);
  assert.equal(cues.length, 2);
  assert.equal(cues[1].start, 60.5);
  assert.equal(cues[1].text, 'Second line');
  const vtt = parseTranscript('WEBVTT\n\n00:02.000 --> 00:03.000 align:start\nShort form\n');
  assert.equal(vtt[0].start, 2);
  assert.equal(excerpt(cues, 0, 10), 'Hello there');
});

test('exports carry timecodes and markers', () => {
  const peaks = [{ start: 65, end: 70, at: 66, kind: 'peak' as const, score: 12.5, attention: 0.91, transcript: 'He said "wow", then paused' }];
  const drops = [{ start: 3600, end: 3640, at: 3610, kind: 'dropoff' as const, score: 14, attention: 0.52, transcript: '' }];
  assert.equal(timecode(3661.5, 25), '01:01:01:13');
  const csv = toCsv(peaks, drops, 25);
  assert.match(csv, /peak,Peak 1: 12\.5 presses\/100,65,70,00:01:05:00/);
  assert.match(csv, /"He said ""wow"", then paused"/);
  const edl = toEdl('Test', peaks, drops, 25);
  assert.match(edl, /\|C:ResolveColorGreen \|M:Peak 1/);
  assert.match(edl, /\|C:ResolveColorRed \|M:Drop-off 1/);
  const xml = toPremiereXml('A & B', 5745, peaks, drops, 25);
  assert.match(xml, /<in>1625<\/in>/);
  assert.match(xml, /A &amp; B/);
});

test('rewritePlaylist proxies plain and URI= references with signatures', () => {
  const master = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/a.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1\nhttps://x.previews.dropboxusercontent.com/v.m3u8?a=1\n';
  const out = rewritePlaylist(master, 'https://x.previews.dropboxusercontent.com/p/master.m3u8', 'tok');
  const lines = out.split('\n');
  assert.match(lines[1], /URI="\/stream\/p\?u=/);
  const u = new URL(`http://h${lines[3]}`);
  assert.equal(decodeProxied(u.searchParams.get('u'), u.searchParams.get('h'), 'tok'), 'https://x.previews.dropboxusercontent.com/v.m3u8?a=1');
  assert.equal(decodeProxied(u.searchParams.get('u'), u.searchParams.get('h'), 'other-token'), undefined);
  const audio = new URL(`http://h${lines[1].match(/URI="([^"]+)"/)![1]}`);
  assert.equal(decodeProxied(audio.searchParams.get('u'), audio.searchParams.get('h'), 'tok'), 'https://x.previews.dropboxusercontent.com/p/audio/a.m3u8');
});

test('Dropbox Replay helpers', () => {
  assert.equal(parseReplayToken('https://replay.dropbox.com/share/qxsXZ0hahSv4hgSx'), 'qxsXZ0hahSv4hgSx');
  assert.equal(parseReplayToken('https://example.com/share/abc'), undefined);
  assert.equal(extractClientAuth('x,z3="abcdefghij12345",Pee="klmnopqrst67890",_8e="production",NE=1'), 'abcdefghij12345:klmnopqrst67890');
  const r = parseReplayResponse({ shared_entity: { name: 'Ep', transcode_url: 'https://a.previews.dropboxusercontent.com/m.m3u8', poster_url: 'p', video_metadata: { duration_precise: 5745, frame_rate: 25, resolution_width: 1920, resolution_height: 1080 } } });
  assert.equal(r.durationSec, 5745);
  assert.equal(r.kind, 'hls');
  assert.throws(() => parseReplayResponse({ shared_entity: { requires_password: true } }), /password/);
});

test('findDropoffs keeps a noisy dip whole instead of splitting it', () => {
  const att: number[] = new Array(300).fill(0.8);
  // A 60 s dip right at the threshold, with 2-3 s blips back above it.
  for (let i = 100; i < 160; i++) att[i] = i % 10 < 7 ? 0.68 : 0.75;
  const drops = findDropoffs(att, new Array(300).fill(0.8), 0);
  assert.equal(drops.length, 1);
  assert.equal(drops[0].start, 100);
  assert.ok(drops[0].end >= 157);
});
