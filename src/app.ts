import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { config } from './config.ts';
import type { Store } from './db.ts';
import { exportFilename } from './naming.ts';
import { toCsv, toEdl, toPremiereXml } from './exports.ts';
import { HttpError, Router, parseCookies, readBody, sendJson, serveStatic, type Ctx } from './http.ts';
import { decodeProxied, masterPlaylist, relay } from './hlsProxy.ts';
import { evaluateSession, rangeFor, sweepAbandoned } from './quality.ts';
import { buildReport } from './scoring.ts';
import { makeToken, readToken } from './signing.ts';
import { simulatePanel } from './simulate.ts';
import { RESOLVE_MAX_AGE_MS, detectSourceType, resolveSource } from './sources/index.ts';
import { parseTranscript } from './transcript.ts';
import type { CutRow, DemographicKey, Sample, SessionRow, SurveyQuestion, TestConfig, TestRow, ViewerEvent } from './types.ts';
import { DEMOGRAPHIC_KEYS } from './types.ts';

type FetchLike = typeof fetch;

const STUDIO_COOKIE = 'pw_studio';

export const DEFAULT_SURVEY: SurveyQuestion[] = [
  { id: 'overall', text: 'How much did you enjoy this episode? (1 = not at all, 10 = loved it)', kind: 'scale' },
  { id: 'share', text: 'Would you share this episode with a friend?', kind: 'yesno' },
  { id: 'best', text: 'What was the best moment, and why?', kind: 'text' },
  { id: 'worst', text: 'Was there a moment you wanted to skip? What was it?', kind: 'text' },
];

export function defaultConfig(): TestConfig {
  return { targetViewers: 1000, quotas: {}, survey: DEFAULT_SURVEY, attentionChecks: 3, minWatchPct: 0.7, maxPauseSec: 900 };
}

// ---------- input validation ----------

const str = (v: unknown, max = 500): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
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
  if (active >= test.config.targetViewers) return 'This test is full. Thank you for your interest.';
  for (const key of DEMOGRAPHIC_KEYS) {
    const quota = test.config.quotas[key];
    if (!quota) continue;
    const value = demographics[key];
    if (!value || !(value in quota)) return 'This test is looking for a different audience. Thank you for your interest.';
    const target = Math.ceil(quota[value] * test.config.targetViewers);
    if ((store.quotaCounts(test.id, key).get(value) ?? 0) >= target) return 'We have enough viewers like you for this test. Thank you for your interest.';
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

// ---------- app ----------

export function createApp(store: Store, fetchImpl: FetchLike = fetch) {
  const router = new Router();

  const isStudio = (req: IncomingMessage) => readToken(parseCookies(req)[STUDIO_COOKIE])?.role === 'studio';
  const requireStudio = (ctx: Ctx) => {
    if (!isStudio(ctx.req)) throw new HttpError(401, 'Sign in to the studio first');
  };
  const getTestOr404 = (id: string) => {
    const t = store.getTest(id);
    if (!t) throw new HttpError(404, 'Test not found');
    return t;
  };
  const durationOf = (cutId: string) => store.getCut(cutId)?.resolved?.durationSec ?? 0;

  /** Returns a cut whose signed upstream URL is fresh enough to stream. */
  async function freshCut(cut: CutRow): Promise<CutRow> {
    if (cut.resolved && (cut.source_type !== 'dropbox_replay' || Date.now() - cut.resolved.resolvedAt < RESOLVE_MAX_AGE_MS)) return cut;
    const resolved = await resolveSource(cut.source_type, cut.source_url, { durationSec: cut.resolved?.durationSec, fps: cut.resolved?.fps, name: cut.resolved?.name }, fetchImpl);
    store.setCutResolved(cut.id, resolved);
    return { ...cut, resolved };
  }

  function streamFor(cut: CutRow, subject: string) {
    const k = makeToken({ cut: cut.id, sub: subject }, config.streamTokenTtlSec);
    const kind = cut.resolved?.kind ?? 'hls';
    return { kind, src: kind === 'hls' ? `/stream/${cut.id}/master.m3u8?k=${encodeURIComponent(k)}` : `/stream/${cut.id}/video.mp4?k=${encodeURIComponent(k)}` };
  }

  function testSummary(t: TestRow) {
    const sessions = store.listSessions(t.id);
    const cuts = store.getCuts(t.id);
    return {
      ...t,
      cuts: cuts.map((c) => ({ id: c.id, label: c.label, sourceType: c.source_type, sourceUrl: c.source_url, name: c.resolved?.name, durationSec: c.resolved?.durationSec, fps: c.resolved?.fps, posterUrl: c.resolved?.posterUrl, width: c.resolved?.width, height: c.resolved?.height })),
      counts: {
        sessions: sessions.length,
        watching: sessions.filter((s) => s.status === 'watching' || s.status === 'started').length,
        completed: sessions.filter((s) => s.status === 'completed').length,
        valid: sessions.filter((s) => s.valid === 1).length,
        screenedOut: sessions.filter((s) => s.status === 'screened_out').length,
        synthetic: sessions.filter((s) => s.synthetic).length,
      },
      panelLink: `/watch/${t.id}`,
    };
  }

  // ---- studio auth ----
  router.on('POST', '/api/login', async (ctx) => {
    const { password } = (await ctx.body()) as { password?: string };
    if (password !== config.studioPassword) throw new HttpError(401, 'Wrong password');
    const token = makeToken({ role: 'studio' }, 7 * 86400);
    ctx.res.setHeader('set-cookie', `${STUDIO_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`);
    return { ok: true };
  });
  router.on('POST', '/api/logout', (ctx) => {
    ctx.res.setHeader('set-cookie', `${STUDIO_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return { ok: true };
  });
  router.on('GET', '/api/me', (ctx) => ({ studio: isStudio(ctx.req) }));

  // ---- studio: tests ----
  router.on('GET', '/api/tests', (ctx) => {
    requireStudio(ctx);
    return store.listTests().map(testSummary);
  });

  router.on('POST', '/api/tests', async (ctx) => {
    requireStudio(ctx);
    const b = (await ctx.body()) as Record<string, unknown>;
    const title = str(b.title, 200);
    if (!title) throw new HttpError(400, 'Title is required');
    const rawCuts = Array.isArray(b.cuts) ? (b.cuts as Record<string, unknown>[]).slice(0, 4) : [];
    if (!rawCuts.length) throw new HttpError(400, 'Add at least one video link');
    const cuts = [];
    for (const [i, c] of rawCuts.entries()) {
      const url = str(c.url, 2000);
      let type;
      try {
        type = detectSourceType(url);
      } catch {
        throw new HttpError(400, `Cut ${i + 1}: not a valid URL`);
      }
      try {
        const resolved = await resolveSource(type, url, { durationSec: Number(c.durationSec) || undefined, fps: Number(c.fps) || undefined, name: str(c.label, 100) }, fetchImpl);
        cuts.push({ label: str(c.label, 100) || `Cut ${String.fromCharCode(65 + i)}`, sourceType: type, sourceUrl: url, resolved });
      } catch (err) {
        throw new HttpError(400, `Cut ${i + 1}: ${(err as Error).message}`);
      }
    }
    const transcript = typeof b.transcript === 'string' && b.transcript.trim() ? parseTranscript(b.transcript) : [];
    const test = store.createTest({ title, config: normalizeConfig(b.config), transcript, cuts });
    return testSummary(test);
  });

  router.on('GET', '/api/tests/:id', (ctx) => {
    requireStudio(ctx);
    return testSummary(getTestOr404(ctx.params.id));
  });

  router.on('PATCH', '/api/tests/:id', async (ctx) => {
    requireStudio(ctx);
    const t = getTestOr404(ctx.params.id);
    const b = (await ctx.body()) as Record<string, unknown>;
    const status = ['draft', 'live', 'closed'].includes(b.status as string) ? (b.status as TestRow['status']) : undefined;
    store.updateTest(t.id, {
      title: str(b.title, 200) || undefined,
      status,
      config: b.config ? normalizeConfig(b.config, t.config) : undefined,
      transcript: typeof b.transcript === 'string' ? parseTranscript(b.transcript) : undefined,
    });
    return testSummary(getTestOr404(t.id));
  });

  router.on('DELETE', '/api/tests/:id', (ctx) => {
    requireStudio(ctx);
    store.deleteTest(getTestOr404(ctx.params.id).id);
    return { ok: true };
  });

  router.on('POST', '/api/tests/:id/simulate', async (ctx) => {
    requireStudio(ctx);
    const t = getTestOr404(ctx.params.id);
    const b = (await ctx.body()) as { viewers?: number };
    const n = Math.round(num(b.viewers, 1, 2000, 200));
    let made = 0;
    for (const cut of store.getCuts(t.id)) made += simulatePanel(store, t, cut, Math.ceil(n / store.getCuts(t.id).length));
    return { created: made };
  });

  router.on('DELETE', '/api/tests/:id/synthetic', (ctx) => {
    requireStudio(ctx);
    return { deleted: store.deleteSyntheticSessions(getTestOr404(ctx.params.id).id) };
  });

  router.on('GET', '/api/tests/:id/sessions', (ctx) => {
    requireStudio(ctx);
    const t = getTestOr404(ctx.params.id);
    return store.listSessions(t.id).map((s) => ({
      id: s.id, pid: s.pid, cut: s.cut_id, status: s.status, valid: s.valid, excludeReason: s.exclude_reason, synthetic: !!s.synthetic,
      age_band: s.age_band, gender: s.gender, country: s.country, member: s.member,
      maxPt: s.max_pt, pauses: s.pauses, checks: `${s.checks_passed}/${s.checks_total}`, calibPassed: !!s.calib_passed,
      createdAt: s.created_at, completedAt: s.completed_at,
    }));
  });

  const reportFor = (ctx: Ctx) => {
    requireStudio(ctx);
    const t = getTestOr404(ctx.params.id);
    const cuts = store.getCuts(t.id);
    const cut = cuts.find((c) => c.id === ctx.url.searchParams.get('cut')) ?? cuts[0];
    if (!cut) throw new HttpError(404, 'Test has no cuts');
    sweepAbandoned(store, t.id, t.config, durationOf);
    const seg = ctx.url.searchParams.get('segment');
    const segmentKey = DEMOGRAPHIC_KEYS.includes(seg as DemographicKey) ? (seg as DemographicKey) : undefined;
    return { t, cut, report: buildReport(store, t, cut, { includeSynthetic: ctx.url.searchParams.get('synthetic') !== '0', segmentKey, minSegmentViewers: config.minSegmentViewers }) };
  };

  router.on('GET', '/api/tests/:id/report', (ctx) => reportFor(ctx).report);

  router.on('GET', '/api/tests/:id/export/:format', (ctx) => {
    const { t, cut, report } = reportFor(ctx);
    const fps = report.cut.fps;
    const fmt = ctx.params.format;
    const [body, type, ext] =
      fmt === 'csv' ? [toCsv(report.peaks, report.dropoffs, fps), 'text/csv', 'csv']
      : fmt === 'edl' ? [toEdl(t.title, report.peaks, report.dropoffs, fps), 'text/plain', 'edl']
      : fmt === 'xml' ? [toPremiereXml(t.title, report.cut.durationSec, report.peaks, report.dropoffs, fps), 'application/xml', 'xml']
      : [null, '', ''];
    if (body === null) throw new HttpError(404, 'Unknown export format');
    ctx.res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'content-disposition': `attachment; filename="${exportFilename(t.title, cut.label, ext)}"` }).end(body);
    return undefined;
  });

  router.on('GET', '/api/tests/:id/studio-stream', async (ctx) => {
    requireStudio(ctx);
    const t = getTestOr404(ctx.params.id);
    const cut = store.getCuts(t.id).find((c) => c.id === ctx.url.searchParams.get('cut')) ?? store.getCuts(t.id)[0];
    if (!cut) throw new HttpError(404, 'Test has no cuts');
    return streamFor(await freshCut(cut), 'studio');
  });

  // ---- panelist API ----
  const sessionFromKey = (ctx: Ctx): SessionRow => {
    const key = readToken<{ sid: string }>(ctx.req.headers['x-session-key'] as string | undefined);
    const s = key && key.sid === ctx.params.id ? store.getSession(key.sid) : undefined;
    if (!s) throw new HttpError(401, 'Session expired. Please reopen your invite link.');
    return s;
  };

  router.on('GET', '/api/public/tests/:id', (ctx) => {
    const t = getTestOr404(ctx.params.id);
    if (t.status !== 'live' && !isStudio(ctx.req)) throw new HttpError(403, 'This test is not open yet.');
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      preview: t.status !== 'live',
      survey: t.config.survey,
      maxPauseSec: t.config.maxPauseSec,
      quotaOptions: Object.fromEntries(Object.entries(t.config.quotas).map(([k, q]) => [k, Object.keys(q ?? {})])),
      durationSec: Math.max(...store.getCuts(t.id).map((c) => { const r = rangeFor(t.config, c.resolved?.durationSec ?? 0); return r.end - r.start; })),
    };
  });

  router.on('POST', '/api/public/tests/:id/join', async (ctx) => {
    const t = getTestOr404(ctx.params.id);
    const preview = t.status !== 'live';
    if (preview && !isStudio(ctx.req)) throw new HttpError(403, 'This test is not open yet.');
    const b = (await ctx.body()) as { pid?: string; consent?: boolean; demographics?: Record<string, unknown> };
    if (b.consent !== true) throw new HttpError(400, 'Consent is required to take part.');
    const demographics: Record<string, string | null> = {};
    for (const k of DEMOGRAPHIC_KEYS) demographics[k] = str(b.demographics?.[k], 60) || null;
    const pid = str(b.pid, 120) || `anon_${randomBytes(6).toString('hex')}`;

    let session = store.findSessionByPid(t.id, pid);
    if (session?.status === 'completed') throw new HttpError(409, 'You have already completed this test. Thank you!');
    if (session?.status === 'screened_out') throw new HttpError(409, 'This test is looking for a different audience. Thank you for your interest.');
    if (!session) {
      const reason = preview ? null : screen(store, t, demographics);
      const cuts = store.getCuts(t.id);
      const counts = store.sessionCountsByCut(t.id);
      const cut = [...cuts].sort((a, c) => (counts.get(a.id) ?? 0) - (counts.get(c.id) ?? 0) || randomInt(3) - 1)[0];
      session = store.createSession({ testId: t.id, cutId: cut.id, pid, demographics, userAgent: str(ctx.req.headers['user-agent'], 300), status: reason ? 'screened_out' : 'started' });
      if (reason) throw new HttpError(409, reason);
    }
    const cut = await freshCut(store.getCut(session.cut_id)!);
    const range = rangeFor(t.config, cut.resolved?.durationSec ?? 0);
    store.updateSession(session.id, { last_seen: Date.now() });
    return {
      sessionId: session.id,
      sessionKey: makeToken({ sid: session.id }, 7 * 86400),
      shortId: session.id.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase(),
      resumeAt: session.max_pt > range.start ? session.max_pt : range.start,
      calibrated: session.calib_passed === 1,
      range,
      durationSec: cut.resolved?.durationSec,
      posterUrl: cut.resolved?.posterUrl,
      stream: streamFor(cut, session.id),
      checks: scheduleChecks(t.config.attentionChecks, range).filter((c) => c > session!.max_pt),
      maxPauseSec: t.config.maxPauseSec,
    };
  });

  router.on('POST', '/api/public/sessions/:id/stream', async (ctx) => {
    const s = sessionFromKey(ctx);
    const cut = store.getCut(s.cut_id)!;
    // Force a re-resolve: the client calls this after an expired upstream URL broke playback.
    store.setCutResolved(cut.id, { ...cut.resolved!, resolvedAt: 0 });
    return streamFor(await freshCut(store.getCut(s.cut_id)!), s.id);
  });

  router.on('POST', '/api/public/sessions/:id/calibration', async (ctx) => {
    const s = sessionFromKey(ctx);
    const b = (await ctx.body()) as { passed?: boolean; quality?: unknown };
    store.updateSession(s.id, { calib_passed: b.passed ? 1 : 0, calibration: JSON.stringify(b.quality ?? null).slice(0, 5000), status: 'watching', last_seen: Date.now() });
    return { ok: true };
  });

  router.on('POST', '/api/public/sessions/:id/signals', async (ctx) => {
    const s = sessionFromKey(ctx);
    if (s.status === 'completed') return { ok: true };
    const b = (await ctx.body()) as { samples?: unknown[]; events?: unknown[]; pauseSec?: number };
    const dur = durationOf(s.cut_id) + 5;
    const samples = (Array.isArray(b.samples) ? b.samples : [])
      .slice(0, 2000)
      .filter((x): x is Sample => Array.isArray(x) && x.length >= 4 && Number.isFinite(x[0]) && (x[0] as number) >= 0 && (x[0] as number) <= dur)
      .map((x) => [x[0], x[1] ? 1 : 0, x[2] ? 1 : 0, x[3] ? 1 : 0] as Sample);
    const allowed = new Set(['interest', 'bored', 'pause', 'play', 'seek_blocked', 'tab_hidden', 'tab_visible', 'fullscreen_exit', 'check_shown', 'check_passed', 'check_missed', 'rate_blocked']);
    const events = (Array.isArray(b.events) ? b.events : [])
      .slice(0, 500)
      .filter((e): e is ViewerEvent => !!e && typeof e === 'object' && allowed.has((e as ViewerEvent).type) && Number.isFinite((e as ViewerEvent).pt))
      .map((e) => ({ type: e.type, pt: Math.max(0, Math.min(dur, e.pt)), ts: Number(e.ts) || Date.now(), data: e.data && typeof e.data === 'object' ? e.data : undefined }));
    if (samples.length) store.addSamples(s.id, samples);
    if (events.length) store.addEvents(s.id, events);
    const maxPt = Math.max(s.max_pt, ...samples.map((x) => x[0]));
    const count = (type: string) => events.filter((e) => e.type === type).length;
    store.updateSession(s.id, {
      max_pt: maxPt,
      pauses: s.pauses + count('pause'),
      pause_sec: Math.max(s.pause_sec, num(b.pauseSec, 0, 1e6, 0)),
      checks_total: s.checks_total + count('check_shown'),
      checks_passed: s.checks_passed + count('check_passed'),
      last_seen: Date.now(),
      status: s.status === 'started' ? 'watching' : s.status,
    });
    return { ok: true };
  });

  router.on('POST', '/api/public/sessions/:id/complete', async (ctx) => {
    const s = sessionFromKey(ctx);
    const t = getTestOr404(s.test_id);
    const b = (await ctx.body()) as { survey?: Record<string, unknown> };
    const survey: Record<string, unknown> = {};
    for (const q of t.config.survey) {
      const v = b.survey?.[q.id];
      if (q.kind === 'scale') survey[q.id] = v === undefined || v === '' ? null : num(v, 0, 10, 0);
      else if (q.kind === 'yesno') survey[q.id] = v === true || v === 'yes' ? 'yes' : v === false || v === 'no' ? 'no' : null;
      else survey[q.id] = str(v, 2000) || null;
    }
    const code = s.completion_code ?? `PW-${randomBytes(4).toString('hex').toUpperCase()}`;
    store.updateSession(s.id, { status: 'completed', survey: JSON.stringify(survey), completed_at: Date.now(), completion_code: code, last_seen: Date.now() });
    const reason = evaluateSession(store, { ...store.getSession(s.id)! }, t.config, durationOf(s.cut_id));
    const redirect = t.config.completionRedirect ? t.config.completionRedirect.replace('{code}', encodeURIComponent(code)).replace('{pid}', encodeURIComponent(s.pid)) : undefined;
    return { completionCode: code, redirect, counted: reason === null };
  });

  // ---- streaming ----
  async function handleStream(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const k = url.searchParams.get('k') ?? '';
    const token = readToken<{ cut: string; sub: string }>(k);
    if (url.pathname === '/stream/p') {
      const upstream = token ? decodeProxied(url.searchParams.get('u'), url.searchParams.get('h'), k) : undefined;
      if (!upstream) {
        res.writeHead(403).end('Stream link expired');
        return true;
      }
      await relay(req, res, upstream, k, fetchImpl);
      return true;
    }
    const m = url.pathname.match(/^\/stream\/([^/]+)\/(master\.m3u8|video\.mp4)$/);
    if (!m) return false;
    if (!token || token.cut !== m[1]) {
      res.writeHead(403).end('Stream link expired');
      return true;
    }
    const cut = await freshCut(store.getCut(m[1]) ?? (() => { throw new HttpError(404, 'Cut not found'); })());
    if (m[2] === 'video.mp4') {
      await relay(req, res, cut.resolved!.mediaUrl, k, fetchImpl);
      return true;
    }
    let out = await masterPlaylist(cut.resolved!.mediaUrl, k, fetchImpl);
    if (out.status !== 200 && cut.source_type === 'dropbox_replay') {
      store.setCutResolved(cut.id, { ...cut.resolved!, resolvedAt: 0 });
      out = await masterPlaylist((await freshCut(store.getCut(cut.id)!)).resolved!.mediaUrl, k, fetchImpl);
    }
    if (out.status !== 200) {
      res.writeHead(502).end('Could not load the video source');
      return true;
    }
    res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-store' }).end(out.body);
    return true;
  }

  // ---- dispatcher ----
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'same-origin');
    try {
      if (url.pathname.startsWith('/stream/')) {
        if (await handleStream(req, res, url)) return;
      }
      if (url.pathname.startsWith('/api/')) {
        const found = router.match(req.method ?? 'GET', url.pathname);
        if (!found) throw new HttpError(404, 'Not found');
        let bodyPromise: Promise<unknown> | undefined;
        const ctx: Ctx = { req, res, url, params: found.params, body: () => (bodyPromise ??= readBody(req)) };
        const out = await found.handler(ctx);
        if (!res.headersSent) sendJson(res, 200, out ?? { ok: true });
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
      if (url.pathname === '/' || url.pathname === '/studio') {
        res.writeHead(302, { location: '/studio/' }).end();
        return;
      }
      const rel = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
      if (serveStatic(res, config.publicDir, rel.slice(1))) return;
      // Panel links look like /watch/<testId>; any path that is not a real file there gets the viewer app.
      if (/^\/watch\/[^/.]+\/?$/.test(url.pathname) && serveStatic(res, config.publicDir, 'watch/index.html')) return;
      throw new HttpError(404, 'Not found');
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Something went wrong' : (err as Error).message });
      else res.destroy();
    }
  }

  return { handle, server: () => createServer((req, res) => void handle(req, res)) };
}

