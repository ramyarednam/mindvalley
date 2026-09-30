import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.PREWATCH_DATA_DIR = mkdtempSync(join(tmpdir(), 'prewatch-test-'));
process.env.STUDIO_PASSWORD = 'pw-test';
process.env.MIN_SEGMENT_VIEWERS = '5';

const { Store } = await import('../src/db.ts');
const { createApp } = await import('../src/app.ts');

const MEDIA = 'https://abc.previews.dropboxusercontent.com';
const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const text = (body: string, type = 'text/plain') => new Response(body, { status: 200, headers: { 'content-type': type } });
  if (url === 'https://replay.dropbox.com/') return text('<script type="module" src="/static/index-X.js"></script>', 'text/html');
  if (url === 'https://replay.dropbox.com/static/index-X.js') return text('a="abcdefghij12345",b="klmnopqrst67890",c="production"');
  if (url.startsWith('https://api.dropboxapi.com/2/reel/get_with_shared_link')) {
    assert.equal((init?.headers as Record<string, string>).authorization, `Basic ${Buffer.from('abcdefghij12345:klmnopqrst67890').toString('base64')}`);
    return Response.json({ shared_entity: { name: 'Episode V3', transcode_url: `${MEDIA}/p/master.m3u8`, video_metadata: { duration_precise: 600, frame_rate: 25 } } });
  }
  if (url === `${MEDIA}/p/master.m3u8`) return text('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvideo.m3u8\n', 'application/vnd.apple.mpegurl');
  if (url === `${MEDIA}/p/video.m3u8`) return text('#EXTM3U\n#EXTINF:4.0,\nseg0.ts\n', 'application/vnd.apple.mpegurl');
  if (url === `${MEDIA}/p/seg0.ts`) return new Response(new Uint8Array([71, 1, 2, 3]), { headers: { 'content-type': 'video/mp2t' } });
  return new Response('not found', { status: 404 });
};

let server: Server;
let base: string;
let cookie = '';

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text(), headers: res.headers };
}

before(async () => {
  const store = new Store(':memory:');
  server = createApp(store, fakeFetch).server();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

test('end-to-end: create, join, watch, complete, report, export', async () => {
  assert.equal((await call('GET', '/api/tests')).status, 401);
  assert.equal((await call('POST', '/api/login', { password: 'nope' })).status, 401);
  assert.equal((await call('POST', '/api/login', { password: 'pw-test' })).status, 200);

  const created = await call('POST', '/api/tests', {
    title: 'Ben Greenfield',
    cuts: [{ label: 'V3', url: 'https://replay.dropbox.com/share/qxsXZ0hahSv4hgSx' }],
    config: { targetViewers: 3, attentionChecks: 2, quotas: { member: { member: 0.33, 'non-member': 0.67 } } },
    transcript: '1\n00:01:40,000 --> 00:01:50,000\nThe cold plunge story\n',
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const t = created.data;
  assert.equal(t.cuts[0].durationSec, 600);
  assert.equal(t.cuts[0].name, 'Episode V3');

  // Not live yet: anonymous viewers are refused.
  const savedCookie = cookie;
  cookie = '';
  assert.equal((await call('GET', `/api/public/tests/${t.id}`)).status, 403);
  cookie = savedCookie;
  await call('PATCH', `/api/tests/${t.id}`, { status: 'live' });
  cookie = '';

  const info = await call('GET', `/api/public/tests/${t.id}`);
  assert.equal(info.status, 200);
  assert.equal(JSON.stringify(info.data).includes('dropboxusercontent'), false, 'upstream URL must not leak to panelists');

  assert.equal((await call('POST', `/api/public/tests/${t.id}/join`, { pid: 'p0', demographics: {} })).status, 400, 'consent required');
  const demo = { age_band: '25-34', gender: 'female', country: 'UK', member: 'member' };
  const joined = await call('POST', `/api/public/tests/${t.id}/join`, { pid: 'p1', consent: true, demographics: demo });
  assert.equal(joined.status, 200, JSON.stringify(joined.data));
  const j = joined.data;
  assert.equal(j.range.end, 600);
  assert.equal(j.checks.length, 2);

  // Quota: the single member slot is taken.
  const second = await call('POST', `/api/public/tests/${t.id}/join`, { pid: 'p2', consent: true, demographics: demo });
  assert.equal(second.status, 409);
  // Rejoining returns the same session (resume).
  const again = await call('POST', `/api/public/tests/${t.id}/join`, { pid: 'p1', consent: true, demographics: demo });
  assert.equal(again.data.sessionId, j.sessionId);

  // Stream through the proxy.
  const master = await call('GET', j.stream.src);
  assert.equal(master.status, 200);
  const variantPath = (master.data as string).split('\n').find((l) => l.startsWith('/stream/p'))!;
  const variant = await call('GET', variantPath);
  const segPath = (variant.data as string).split('\n').find((l) => l.startsWith('/stream/p'))!;
  const seg = await call('GET', segPath);
  assert.equal(seg.status, 200);
  assert.equal((await call('GET', segPath.replace('&h=', '&h=x'))).status, 403);
  assert.equal((await call('GET', j.stream.src.replace('k=', 'k=bad'))).status, 403);

  const key = { 'x-session-key': j.sessionKey };
  assert.equal((await call('POST', `/api/public/sessions/${j.sessionId}/signals`, {}, {})).status, 401);
  assert.equal((await call('POST', `/api/public/sessions/${j.sessionId}/calibration`, { passed: true, quality: { faceShare: 0.97 } }, key)).status, 200);

  // Watch the whole 600 s: attentive except 200-260 s, spacebar around 100 s.
  const samples: [number, number, number, number][] = [];
  for (let s = 0; s < 600; s += 0.25) samples.push([s, 1, s >= 200 && s < 260 ? 0 : 1, 1]);
  for (let i = 0; i < samples.length; i += 2000) {
    const events = i === 0 ? [{ type: 'interest', pt: 101, ts: Date.now() }, { type: 'check_shown', pt: 150, ts: 1 }, { type: 'check_passed', pt: 152, ts: 2 }, { type: 'check_shown', pt: 400, ts: 3 }, { type: 'check_passed', pt: 401, ts: 4 }, { type: 'bogus', pt: 1, ts: 1 }] : [];
    const r = await call('POST', `/api/public/sessions/${j.sessionId}/signals`, { samples: samples.slice(i, i + 2000), events }, key);
    assert.equal(r.status, 200);
  }
  const done = await call('POST', `/api/public/sessions/${j.sessionId}/complete`, { survey: { overall: 9, share: 'yes', best: 'The plunge' } }, key);
  assert.equal(done.status, 200);
  assert.equal(done.data.counted, true);
  assert.match(done.data.completionCode, /^PW-/);
  assert.equal((await call('POST', `/api/public/tests/${t.id}/join`, { pid: 'p1', consent: true, demographics: demo })).status, 409, 'cannot retake');

  cookie = savedCookie;
  const report = (await call('GET', `/api/tests/${t.id}/report?synthetic=0`)).data;
  assert.equal(report.panel.valid, 1);
  assert.equal(report.curve.attention.length, 600);
  assert.equal(report.curve.attention[100], 1);
  assert.equal(report.curve.attention[230], 0);
  assert.ok(report.dropoffs.some((d: { start: number; end: number }) => d.start <= 205 && d.end >= 255), 'the 200-260 s dip is a drop-off');
  assert.ok(report.peaks.some((p: { start: number; end: number; transcript: string }) => p.start <= 101 && p.end >= 101 && p.transcript === 'The cold plunge story'));
  assert.equal(report.survey[0].mean, 9);

  const csv = await call('GET', `/api/tests/${t.id}/export/csv?synthetic=0`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-disposition') ?? '', /ben-greenfield-v3-markers\.csv/);
  assert.match(csv.data as string, /^type,name,start_sec/);
  assert.equal((await call('GET', `/api/tests/${t.id}/export/xml`)).status, 200);
  assert.equal((await call('GET', `/api/tests/${t.id}/export/edl`)).status, 200);

  // Synthetic panel fills the report and can be removed.
  const sim = await call('POST', `/api/tests/${t.id}/simulate`, { viewers: 40 });
  assert.equal(sim.data.created, 40);
  const withSim = (await call('GET', `/api/tests/${t.id}/report?segment=age_band`)).data;
  assert.ok(withSim.panel.valid > 20);
  assert.ok(withSim.peaks.length > 0);
  assert.ok(withSim.segments[0].options.some((o: { attention?: unknown[] }) => Array.isArray(o.attention)));
  assert.equal((await call('DELETE', `/api/tests/${t.id}/synthetic`)).data.deleted, 40);
});
