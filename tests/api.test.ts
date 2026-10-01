import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.PREWATCH_DATA_DIR = mkdtempSync(join(tmpdir(), 'prewatch-test-'));
process.env.MIN_SEGMENT_VIEWERS = '5';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

const { Store } = await import('../src/db.ts');
const { createApp } = await import('../src/app.ts');
const { setupCode } = await import('../src/auth.ts');

const MEDIA = 'https://abc.previews.dropboxusercontent.com';
const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const text = (body: string, type = 'text/plain') => new Response(body, { status: 200, headers: { 'content-type': type } });
  if (url === 'https://replay.dropbox.com/') return text('<script type="module" src="/static/index-X.js"></script>', 'text/html');
  if (url === 'https://replay.dropbox.com/static/index-X.js') return text('a="abcdefghij12345",b="klmnopqrst67890",c="production"');
  if (url.startsWith('https://api.dropboxapi.com/2/reel/get_with_shared_link')) {
    assert.equal((init?.headers as Record<string, string>).authorization, `Basic ${Buffer.from('abcdefghij12345:klmnopqrst67890').toString('base64')}`);
    return Response.json({ shared_entity: { name: 'Episode V3', transcode_url: `${MEDIA}/p/master.m3u8`, poster_url: `${MEDIA}/poster.png`, video_metadata: { duration_precise: 600, frame_rate: 25 } } });
  }
  if (url === `${MEDIA}/p/master.m3u8`) return text('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvideo.m3u8\n', 'application/vnd.apple.mpegurl');
  if (url === `${MEDIA}/p/video.m3u8`) return text('#EXTM3U\n#EXTINF:4.0,\nseg0.ts\n', 'application/vnd.apple.mpegurl');
  if (url === `${MEDIA}/p/seg0.ts`) return new Response(new Uint8Array([71, 1, 2, 3]), { headers: { 'content-type': 'video/mp2t' } });
  return new Response('not found', { status: 404 });
};

let server: Server;
let base: string;

/** A tiny cookie-keeping client, one per signed-in person. */
function client() {
  let cookie = '';
  return async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, data: type.includes('json') ? await res.json() : await res.text(), headers: res.headers };
  };
}

before(async () => {
  const store = new Store(':memory:');
  server = createApp(store, fakeFetch).server();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

test('accounts: first-run setup, roles, team management', async () => {
  const admin = client();
  assert.equal((await admin('GET', '/api/me')).data.needsSetup, true);
  assert.equal((await admin('POST', '/api/auth/setup', { setupCode: 'wrong', email: 'a@mv.com', password: 'longpassword' })).status, 403);
  const setup = await admin('POST', '/api/auth/setup', { setupCode: setupCode(), name: 'Ramya', email: 'ramya@mv.com', password: 'longpassword' });
  assert.equal(setup.status, 200, JSON.stringify(setup.data));
  assert.equal(setup.data.user.role, 'admin');
  assert.equal((await admin('POST', '/api/auth/setup', { setupCode: setupCode(), email: 'x@mv.com', password: 'longpassword' })).status, 409, 'setup only once');

  const added = await admin('POST', '/api/users', { name: 'Ed Itor', email: 'editor@mv.com', role: 'member' });
  assert.equal(added.status, 200);
  assert.match(added.data.temporaryPassword, /^[a-z]+-[a-z]+-\d{4}$/);

  const member = client();
  assert.equal((await member('POST', '/api/auth/login', { email: 'editor@mv.com', password: 'nope' })).status, 401);
  assert.equal((await member('POST', '/api/auth/login', { email: 'EDITOR@mv.com', password: added.data.temporaryPassword })).status, 200);
  assert.equal((await member('GET', '/api/tests')).status, 200);
  assert.equal((await member('POST', '/api/tests', { title: 'x', cuts: [] })).status, 403, 'members cannot add tests');
  assert.equal((await member('GET', '/api/users')).status, 403, 'members cannot manage the team');
  assert.equal((await member('POST', '/api/me/password', { current: added.data.temporaryPassword, next: 'brandnewpass' })).status, 200);

  const me = (await admin('GET', '/api/me')).data.user;
  assert.equal((await admin('PATCH', `/api/users/${me.id}`, { role: 'member' })).status, 400, 'last admin stays admin');
  assert.equal((await admin('DELETE', `/api/users/${me.id}`)).status, 400, 'cannot remove yourself');
  assert.equal((await client()('GET', '/api/tests')).status, 401);
});

test('end to end: create, watch, save for later, resume, feedback, dashboards', async () => {
  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'ramya@mv.com', password: 'longpassword' });
  const member = client();
  await member('POST', '/api/auth/login', { email: 'editor@mv.com', password: 'brandnewpass' });

  const created = await admin('POST', '/api/tests', {
    title: 'Ben Greenfield',
    description: 'Habits for a longer life',
    cuts: [{ label: 'V3', url: 'https://replay.dropbox.com/share/qxsXZ0hahSv4hgSx' }],
    config: { targetViewers: 3, attentionChecks: 2, quotas: { member: { member: 0.33, 'non-member': 0.67 } }, survey: [{ text: 'Would you watch part two?', kind: 'yesno' }] },
    transcript: '1\n00:01:40,000 --> 00:01:50,000\nThe cold plunge story\n\n2\n00:03:00,000 --> 00:03:05,000\nSleep is the foundation\n',
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const t = created.data;
  assert.equal(t.cuts[0].durationSec, 600);
  assert.equal(t.transcriptLines, 2);

  const viewer = client();
  assert.equal((await viewer('GET', `/api/public/tests/${t.id}`)).status, 403, 'draft is closed to the public');
  assert.equal((await member('GET', `/api/public/tests/${t.id}`)).status, 200, 'team can preview drafts');
  await admin('PATCH', `/api/tests/${t.id}`, { status: 'live' });
  const info = await viewer('GET', `/api/public/tests/${t.id}`);
  assert.equal(info.data.description, 'Habits for a longer life');
  assert.equal(JSON.stringify(info.data).includes('master.m3u8'), false, 'the video source never reaches viewers');

  const demo = { age_band: '25-34', gender: 'female', country: 'UK', member: 'member' };
  const j = (await viewer('POST', `/api/public/tests/${t.id}/join`, { pid: 'p1', consent: true, demographics: demo })).data;
  assert.equal(j.stage, 'watch');
  assert.match(j.resumePath, /\?resume=/);
  assert.equal((await viewer('POST', `/api/public/tests/${t.id}/join`, { pid: 'p2', consent: true, demographics: demo })).status, 409, 'member quota is full');

  // Stream works through the proxy.
  const master = await viewer('GET', j.stream.src);
  const variant = await viewer('GET', (master.data as string).split('\n').find((l) => l.startsWith('/stream/p'))!);
  assert.equal((await viewer('GET', (variant.data as string).split('\n').find((l) => l.startsWith('/stream/p'))!)).status, 200);

  const key = { 'x-session-key': j.sessionKey };
  await viewer('POST', `/api/public/sessions/${j.sessionId}/calibration`, { passed: true }, key);

  // Watch the first half, then "save and finish later".
  const samples = (from: number, to: number) => {
    const out: [number, number, number, number][] = [];
    for (let s = from; s < to; s += 0.25) out.push([s, 1, s >= 200 && s < 260 ? 0 : 1, 1]);
    return out;
  };
  const send = async (k: Record<string, string>, sid: string, from: number, to: number, events: unknown[] = []) => {
    const all = samples(from, to);
    for (let i = 0; i < all.length; i += 2000) assert.equal((await viewer('POST', `/api/public/sessions/${sid}/signals`, { samples: all.slice(i, i + 2000), events: i === 0 ? events : [] }, k)).status, 200);
  };
  await send(key, j.sessionId, 0, 300, [{ type: 'interest', pt: 101, ts: 1 }, { type: 'check_shown', pt: 150, ts: 1 }, { type: 'check_passed', pt: 152, ts: 2 }, { type: 'save_later', pt: 300, ts: 3 }]);

  // Come back with the personal link from another browser.
  const back = (await client()('POST', '/api/public/resume', { resumeKey: j.resumeKey })).data;
  assert.equal(back.sessionId, j.sessionId);
  assert.equal(back.stage, 'watch');
  assert.ok(back.resumeAt >= 299, 'resumes where they stopped');
  const key2 = { 'x-session-key': back.sessionKey };
  await send(key2, back.sessionId, 300, 600, [{ type: 'check_shown', pt: 400, ts: 3 }, { type: 'check_passed', pt: 401, ts: 4 }]);
  assert.equal((await viewer('POST', `/api/public/sessions/${j.sessionId}/feedback`, { answers: { feeling: 5 }, final: true }, key2)).status, 400, 'must finish watching first');
  assert.equal((await viewer('POST', `/api/public/sessions/${j.sessionId}/watched`, {}, key2)).status, 200);

  // Feedback: context, a partial save, leave, resume into the feedback stage, then submit.
  const ctx = (await viewer('GET', `/api/public/sessions/${j.sessionId}/feedback`, undefined, key2)).data;
  assert.equal(ctx.transcript.length, 2);
  assert.equal(ctx.moments[0].at, 101);
  assert.equal(ctx.moments[0].text, 'The cold plunge story');
  await viewer('POST', `/api/public/sessions/${j.sessionId}/feedback`, { answers: { feeling: 5, relevance: 4, liked: 'loved', bogus: 1 } }, key2);
  const later = (await client()('POST', '/api/public/resume', { resumeKey: j.resumeKey })).data;
  assert.equal(later.stage, 'feedback');
  const key3 = { 'x-session-key': later.sessionKey };
  const draft = (await viewer('GET', `/api/public/sessions/${j.sessionId}/feedback`, undefined, key3)).data.draft;
  assert.deepEqual(draft, { feeling: 5, relevance: 4, liked: 'loved' });
  const sent = await viewer('POST', `/api/public/sessions/${j.sessionId}/feedback`, {
    final: true,
    answers: { recommend: 9, standoutLines: [0, 0, 7], standoutWhy: 'Ice baths, who knew', momentNotes: { 101: 'The story got me' }, oneLiner: 'How to live longer', titleIdea: 'I Tried Ice Baths For 30 Days', wouldCut: 'Nothing', custom: { q1: 'yes' } },
  }, key3);
  assert.match(sent.data.completionCode, /^PW-/);
  assert.equal((await client()('POST', '/api/public/resume', { resumeKey: j.resumeKey })).data.stage, 'done');

  // Member dashboards.
  const list = (await member('GET', '/api/tests')).data;
  assert.equal(list[0].stats.responses, 1);
  assert.equal(list[0].stats.likedShare, 1);
  assert.equal(list[0].config.completionRedirect, undefined, 'members do not see admin settings');
  assert.equal(list[0].cuts[0].sourceUrl, undefined, 'members do not see the source link');

  const report = (await member('GET', `/api/tests/${t.id}/report?synthetic=0`)).data;
  assert.equal(report.panel.valid, 1);
  assert.equal(report.curve.attention[100], 1);
  assert.equal(report.curve.attention[230], 0);
  assert.ok(report.dropoffs.some((d: { start: number; end: number }) => d.start <= 205 && d.end >= 255));

  const fb = (await member('GET', `/api/tests/${t.id}/feedback?synthetic=0`)).data;
  assert.equal(fb.responses, 1);
  assert.equal(fb.feeling.mean, 5);
  assert.equal(fb.recommend.nps, 100);
  assert.deepEqual(fb.standoutLines.map((l: { text: string }) => l.text), ['The cold plunge story'], 'duplicate and out-of-range lines dropped');
  assert.equal(fb.titleIdeas[0].text, 'I Tried Ice Baths For 30 Days');
  assert.equal(fb.custom[0].yesShare, 1);

  const summary = (await member('GET', `/api/tests/${t.id}/summary?synthetic=0`)).data;
  assert.equal(summary.aiAvailable, false);
  assert.match(summary.auto.headline, /100% liked it/);
  assert.equal(summary.auto.hookCandidates[0].quote, 'The cold plunge story');
  assert.equal((await member('POST', `/api/tests/${t.id}/summary`)).status, 400, 'AI summary needs a key');

  const responses = (await member('GET', `/api/tests/${t.id}/responses?synthetic=0`)).data;
  assert.equal(responses[0].feedback.oneLiner, 'How to live longer');
  assert.equal(responses[0].standoutLines[0].text, 'The cold plunge story');
  assert.equal(responses[0].pid, undefined, 'panel IDs are admin-only');
  assert.equal((await admin('GET', `/api/tests/${t.id}/responses?synthetic=0`)).data[0].pid, 'p1');

  assert.match((await member('GET', `/api/tests/${t.id}/export/csv?synthetic=0`)).data as string, /^type,name,start_sec/);
  assert.equal((await member('GET', `/api/tests/${t.id}/stream`)).status, 200);

  // Synthetic viewers feed every dashboard and can be removed.
  assert.equal((await member('POST', `/api/tests/${t.id}/simulate`, { viewers: 40 })).status, 403);
  assert.equal((await admin('POST', `/api/tests/${t.id}/simulate`, { viewers: 40 })).data.created, 40);
  const fbAll = (await member('GET', `/api/tests/${t.id}/feedback`)).data;
  assert.ok(fbAll.responses > 20);
  const seg = (await member('GET', `/api/tests/${t.id}/report?segment=age_band`)).data;
  assert.ok(seg.segments[0].options.some((o: { attention?: unknown[] }) => Array.isArray(o.attention)));
  assert.equal((await admin('DELETE', `/api/tests/${t.id}/synthetic`)).data.deleted, 40);
});
