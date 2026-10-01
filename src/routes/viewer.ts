import { randomBytes, randomInt } from 'node:crypto';
import { MAX_STANDOUT_LINES, normalizeFeedback, parseFeedback } from '../feedback.ts';
import { HttpError, type Ctx, type Router } from '../http.ts';
import { evaluateSession, rangeFor } from '../quality.ts';
import { makeToken, readToken } from '../signing.ts';
import { scheduleChecks, screen, num, str } from '../testConfig.ts';
import { excerpt } from '../transcript.ts';
import type { Sample, SessionRow, TestRow, ViewerEvent } from '../types.ts';
import { DEMOGRAPHIC_KEYS } from '../types.ts';
import type { Deps } from './context.ts';

const ALLOWED_EVENTS = new Set<ViewerEvent['type']>(['interest', 'bored', 'save_later', 'pause', 'play', 'seek_blocked', 'tab_hidden', 'tab_visible', 'fullscreen_exit', 'check_shown', 'check_passed', 'check_missed', 'rate_blocked']);

export function registerViewerRoutes(router: Router, d: Deps): void {
  const { store } = d;

  const sessionFromKey = (ctx: Ctx): SessionRow => {
    const key = readToken<{ sid: string }>(ctx.req.headers['x-session-key'] as string | undefined);
    const s = key && key.sid === ctx.params.id ? store.getSession(key.sid) : undefined;
    if (!s) throw new HttpError(401, 'Your session expired. Open your personal link again to continue.');
    return s;
  };

  const canPreview = (ctx: Ctx) => !!d.currentUser(ctx.req);

  /** Everything the viewer app needs to pick up where this person is: watching, giving feedback, or done. */
  async function sessionPayload(ctx: Ctx, t: TestRow, session: SessionRow) {
    let resumeKey = session.resume_key;
    if (!resumeKey) {
      resumeKey = randomBytes(12).toString('base64url');
      store.updateSession(session.id, { resume_key: resumeKey });
    }
    const stage = session.status === 'completed' ? 'done' : session.status === 'watched' ? 'feedback' : 'watch';
    const cut = stage === 'watch' ? await d.freshCut(store.getCut(session.cut_id)!) : store.getCut(session.cut_id)!;
    const range = rangeFor(t.config, cut.resolved?.durationSec ?? 0);
    store.updateSession(session.id, { last_seen: Date.now() });
    return {
      testId: t.id,
      title: t.title,
      sessionId: session.id,
      sessionKey: makeToken({ sid: session.id }, 30 * 86400),
      resumeKey,
      resumePath: `/watch/${t.id}?resume=${resumeKey}`,
      shortId: session.id.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase(),
      stage,
      resumeAt: session.max_pt > range.start ? session.max_pt : range.start,
      range,
      durationSec: cut.resolved?.durationSec,
      posterUrl: cut.resolved?.posterUrl ? `/poster/${cut.id}` : undefined,
      stream: stage === 'watch' ? d.streamFor(cut, session.id) : undefined,
      checks: stage === 'watch' ? scheduleChecks(t.config.attentionChecks, range).filter((c) => c > session.max_pt) : [],
      maxPauseSec: t.config.maxPauseSec,
      completionCode: stage === 'done' ? session.completion_code : undefined,
    };
  }

  router.on('GET', '/api/public/tests/:id', (ctx) => {
    const t = d.getTestOr404(ctx.params.id);
    if (t.status !== 'live' && !canPreview(ctx)) throw new HttpError(403, t.status === 'closed' ? 'This screening has closed. Thank you for your interest!' : 'This screening is not open yet.');
    const cuts = store.getCuts(t.id);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      preview: t.status !== 'live',
      posterUrl: cuts[0]?.resolved?.posterUrl ? `/poster/${cuts[0].id}` : undefined,
      quotaOptions: Object.fromEntries(Object.entries(t.config.quotas).map(([k, q]) => [k, Object.keys(q ?? {})])),
      durationSec: Math.max(0, ...cuts.map((c) => { const r = rangeFor(t.config, c.resolved?.durationSec ?? 0); return r.end - r.start; })),
    };
  });

  router.on('POST', '/api/public/tests/:id/join', async (ctx) => {
    const t = d.getTestOr404(ctx.params.id);
    const preview = t.status !== 'live';
    if (preview && !canPreview(ctx)) throw new HttpError(403, 'This screening is not open.');
    const b = (await ctx.body()) as { pid?: string; consent?: boolean; demographics?: Record<string, unknown> };
    if (b.consent !== true) throw new HttpError(400, 'Please agree to the terms to take part.');
    const demographics: Record<string, string | null> = {};
    for (const k of DEMOGRAPHIC_KEYS) demographics[k] = str(b.demographics?.[k], 60) || null;
    const pid = str(b.pid, 120) || `anon_${randomBytes(6).toString('hex')}`;

    let session = store.findSessionByPid(t.id, pid);
    if (session?.status === 'screened_out') throw new HttpError(409, 'This screening is looking for a different audience this time. Thank you for your interest!');
    if (!session) {
      const reason = preview ? null : screen(store, t, demographics);
      const cuts = store.getCuts(t.id);
      const counts = store.sessionCountsByCut(t.id);
      const cut = [...cuts].sort((a, c) => (counts.get(a.id) ?? 0) - (counts.get(c.id) ?? 0) || randomInt(3) - 1)[0];
      session = store.createSession({ testId: t.id, cutId: cut.id, pid, demographics, userAgent: str(ctx.req.headers['user-agent'], 300), status: reason ? 'screened_out' : 'started' });
      if (reason) throw new HttpError(409, reason);
    }
    return sessionPayload(ctx, t, session);
  });

  // Personal "continue later" link: works for watching, for feedback after watching, and shows the code when done.
  router.on('POST', '/api/public/resume', async (ctx) => {
    const b = (await ctx.body()) as { resumeKey?: string };
    const session = b.resumeKey ? store.findSessionByResumeKey(str(b.resumeKey, 40)) : undefined;
    if (!session || session.status === 'screened_out') throw new HttpError(404, 'We could not find that link. Please use the invite link you were sent.');
    const t = d.getTestOr404(session.test_id);
    if (t.status === 'closed' && session.status !== 'completed' && session.status !== 'watched') throw new HttpError(403, 'This screening has closed. Thank you!');
    return sessionPayload(ctx, t, session);
  });

  router.on('POST', '/api/public/sessions/:id/stream', async (ctx) => {
    const s = sessionFromKey(ctx);
    const cut = store.getCut(s.cut_id)!;
    // Force a re-resolve: the client calls this after an expired upstream URL broke playback.
    store.setCutResolved(cut.id, { ...cut.resolved!, resolvedAt: 0 });
    return d.streamFor(await d.freshCut(store.getCut(s.cut_id)!), s.id);
  });

  router.on('POST', '/api/public/sessions/:id/calibration', async (ctx) => {
    const s = sessionFromKey(ctx);
    const b = (await ctx.body()) as { passed?: boolean; quality?: unknown };
    // A resumed viewer recalibrates; keep a pass from earlier if this attempt is worse.
    const passed = b.passed ? 1 : s.calib_passed;
    store.updateSession(s.id, { calib_passed: passed, calibration: JSON.stringify(b.quality ?? null).slice(0, 5000), status: s.status === 'started' ? 'watching' : s.status, last_seen: Date.now() });
    return { ok: true };
  });

  router.on('POST', '/api/public/sessions/:id/signals', async (ctx) => {
    const s = sessionFromKey(ctx);
    if (s.status === 'completed' || s.status === 'watched') return { ok: true };
    const b = (await ctx.body()) as { samples?: unknown[]; events?: unknown[]; pauseSec?: number };
    const dur = d.durationOf(s.cut_id) + 5;
    const samples = (Array.isArray(b.samples) ? b.samples : [])
      .slice(0, 2000)
      .filter((x): x is Sample => Array.isArray(x) && x.length >= 4 && Number.isFinite(x[0]) && (x[0] as number) >= 0 && (x[0] as number) <= dur)
      .map((x) => [x[0], x[1] ? 1 : 0, x[2] ? 1 : 0, x[3] ? 1 : 0] as Sample);
    const events = (Array.isArray(b.events) ? b.events : [])
      .slice(0, 500)
      .filter((e): e is ViewerEvent => !!e && typeof e === 'object' && ALLOWED_EVENTS.has((e as ViewerEvent).type) && Number.isFinite((e as ViewerEvent).pt))
      .map((e) => ({ type: e.type, pt: Math.max(0, Math.min(dur, e.pt)), ts: Number(e.ts) || Date.now(), data: e.data && typeof e.data === 'object' ? e.data : undefined }));
    if (samples.length) store.addSamples(s.id, samples);
    if (events.length) store.addEvents(s.id, events);
    const count = (type: string) => events.filter((e) => e.type === type).length;
    store.updateSession(s.id, {
      max_pt: Math.max(s.max_pt, ...samples.map((x) => x[0])),
      pauses: s.pauses + count('pause'),
      pause_sec: Math.max(s.pause_sec, num(b.pauseSec, 0, 1e6, 0)),
      checks_total: s.checks_total + count('check_shown'),
      checks_passed: s.checks_passed + count('check_passed'),
      last_seen: Date.now(),
      status: s.status === 'started' ? 'watching' : s.status,
    });
    return { ok: true };
  });

  // Video finished: attention data is complete and scored now, even if feedback comes later.
  router.on('POST', '/api/public/sessions/:id/watched', (ctx) => {
    const s = sessionFromKey(ctx);
    const t = d.getTestOr404(s.test_id);
    if (s.status === 'watching' || s.status === 'started' || s.status === 'abandoned') {
      store.updateSession(s.id, { status: 'watched', last_seen: Date.now() });
      evaluateSession(store, store.getSession(s.id)!, t.config, d.durationOf(s.cut_id));
    }
    return { ok: true };
  });

  router.on('GET', '/api/public/sessions/:id/feedback', (ctx) => {
    const s = sessionFromKey(ctx);
    const t = d.getTestOr404(s.test_id);
    const moments = store.interestMoments(s.id);
    // Merge presses within 8 s into one moment so viewers are not asked about the same thing twice.
    const merged: number[] = [];
    for (const pt of moments) if (!merged.length || pt - merged.at(-1)! > 8) merged.push(pt);
    return {
      title: t.title,
      transcript: t.transcript.map((c) => ({ start: c.start, text: c.text })),
      maxStandoutLines: MAX_STANDOUT_LINES,
      moments: merged.slice(0, 8).map((pt) => ({ at: Math.round(pt), text: excerpt(t.transcript, pt - 6, pt + 4, 200) })),
      custom: t.config.survey,
      draft: parseFeedback(s),
    };
  });

  router.on('POST', '/api/public/sessions/:id/feedback', async (ctx) => {
    const s = sessionFromKey(ctx);
    const t = d.getTestOr404(s.test_id);
    if (s.status === 'completed') return { completionCode: s.completion_code };
    const b = (await ctx.body()) as { answers?: unknown; final?: boolean };
    const answers = { ...parseFeedback(s), ...normalizeFeedback(b.answers, { cueCount: t.transcript.length, custom: t.config.survey }) };
    store.updateSession(s.id, { survey: JSON.stringify(answers), last_seen: Date.now() });
    if (!b.final) return { saved: true };
    if (s.status !== 'watched') throw new HttpError(400, 'Finish watching the episode first.');
    const code = s.completion_code ?? `PW-${randomBytes(4).toString('hex').toUpperCase()}`;
    store.updateSession(s.id, { status: 'completed', completion_code: code, completed_at: Date.now(), feedback_at: Date.now() });
    const redirect = t.config.completionRedirect ? t.config.completionRedirect.replace('{code}', encodeURIComponent(code)).replace('{pid}', encodeURIComponent(s.pid)) : undefined;
    return { completionCode: code, redirect };
  });
}
