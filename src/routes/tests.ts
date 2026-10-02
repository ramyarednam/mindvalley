import { config } from '../config.ts';
import { toCsv, toEdl, toPremiereXml } from '../exports.ts';
import { aggregateFeedback, parseFeedback } from '../feedback.ts';
import { HttpError, type Ctx, type Router } from '../http.ts';
import { exportFilename } from '../naming.ts';
import { rangeFor, sweepAbandoned } from '../quality.ts';
import { buildReport } from '../scoring.ts';
import { simulatePanel } from '../simulate.ts';
import { detectSourceType, resolveSource } from '../sources/index.ts';
import { autoSummary, claudeAvailable, claudeSummary, summaryInput } from '../summary.ts';
import { normalizeConfig, num, str } from '../testConfig.ts';
import { parseTranscript } from '../transcript.ts';
import type { CutRow, DemographicKey, TestRow } from '../types.ts';
import { DEMOGRAPHIC_KEYS } from '../types.ts';
import type { Deps } from './context.ts';

export function registerTestRoutes(router: Router, d: Deps): void {
  const { store } = d;

  /** Dashboard card numbers, cached until the test's sessions change. */
  const statsCache = new Map<string, { stamp: string; stats: ReturnType<typeof computeStats> }>();

  function computeStats(t: TestRow) {
    const sessions = store.listSessions(t.id);
    const cuts = store.getCuts(t.id);
    const att = store.db
      .prepare(
        `SELECT AVG(1.0 * ss.attentive / ss.samples) AS a FROM session_seconds ss JOIN sessions s ON s.id = ss.session_id
         WHERE s.test_id = ? AND s.valid = 1 AND ss.samples > 0`,
      )
      .get(t.id) as { a: number | null };
    const fb = aggregateFeedback(sessions, t.transcript, t.config.survey);
    return {
      sessions: sessions.length,
      watching: sessions.filter((s) => s.status === 'watching' || s.status === 'started').length,
      awaitingFeedback: sessions.filter((s) => s.status === 'watched').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      valid: sessions.filter((s) => s.valid === 1).length,
      screenedOut: sessions.filter((s) => s.status === 'screened_out').length,
      synthetic: sessions.filter((s) => s.synthetic).length,
      responses: fb.responses,
      avgAttention: att.a,
      likedShare: fb.liked.likedShare,
      relevantShare: fb.relevance.relevantShare,
      nps: fb.recommend.nps,
      cuts: cuts.length,
    };
  }

  function stats(t: TestRow) {
    const stamp = store.db.prepare('SELECT COUNT(*) || \':\' || COALESCE(MAX(last_seen), 0) || \':\' || COALESCE(SUM(valid), 0) AS s FROM sessions WHERE test_id = ?').get(t.id) as { s: string };
    const hit = statsCache.get(t.id);
    if (hit && hit.stamp === stamp.s) return hit.stats;
    const fresh = computeStats(t);
    statsCache.set(t.id, { stamp: stamp.s, stats: fresh });
    return fresh;
  }

  function cutInfo(c: CutRow) {
    return { id: c.id, label: c.label, sourceType: c.source_type, name: c.resolved?.name, durationSec: c.resolved?.durationSec, fps: c.resolved?.fps, posterUrl: c.resolved?.posterUrl ? `/poster/${c.id}` : undefined, width: c.resolved?.width, height: c.resolved?.height };
  }

  function testView(t: TestRow, admin: boolean) {
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      createdAt: t.created_at,
      config: admin ? t.config : { targetViewers: t.config.targetViewers, survey: t.config.survey, range: t.config.range },
      transcriptLines: t.transcript.length,
      cuts: store.getCuts(t.id).map((c) => ({ ...cutInfo(c), ...(admin ? { sourceUrl: c.source_url } : {}) })),
      stats: stats(t),
      panelLink: `/watch/${t.id}`,
    };
  }

  const viewParams = (ctx: Ctx) => {
    const t = d.getTestOr404(ctx.params.id);
    const cut = d.cutFor(t, ctx.url.searchParams.get('cut'));
    const includeSynthetic = ctx.url.searchParams.get('synthetic') !== '0';
    return { t, cut, includeSynthetic };
  };

  const cutSessions = (testId: string, cutId: string, includeSynthetic: boolean) => store.listSessions(testId).filter((s) => s.cut_id === cutId && (includeSynthetic || !s.synthetic));

  // ---- read: every signed-in member ----

  router.on('GET', '/api/tests', (ctx) => {
    const u = d.requireUser(ctx);
    return store.listTests().map((t) => testView(t, u.role === 'admin'));
  });

  router.on('GET', '/api/tests/:id', (ctx) => {
    const u = d.requireUser(ctx);
    return testView(d.getTestOr404(ctx.params.id), u.role === 'admin');
  });

  const report = (ctx: Ctx) => {
    d.requireUser(ctx);
    const { t, cut, includeSynthetic } = viewParams(ctx);
    sweepAbandoned(store, t.id, t.config, d.durationOf);
    const seg = ctx.url.searchParams.get('segment');
    const segmentKey = DEMOGRAPHIC_KEYS.includes(seg as DemographicKey) ? (seg as DemographicKey) : undefined;
    return { t, cut, includeSynthetic, report: buildReport(store, t, cut, { includeSynthetic, segmentKey, minSegmentViewers: config.minSegmentViewers }) };
  };

  router.on('GET', '/api/tests/:id/report', (ctx) => report(ctx).report);

  router.on('GET', '/api/tests/:id/feedback', (ctx) => {
    d.requireUser(ctx);
    const { t, cut, includeSynthetic } = viewParams(ctx);
    return aggregateFeedback(cutSessions(t.id, cut.id, includeSynthetic), t.transcript, t.config.survey);
  });

  const summaryKey = (cutId: string, includeSynthetic: boolean) => `${cutId}:${includeSynthetic ? 'all' : 'real'}`;

  router.on('GET', '/api/tests/:id/summary', (ctx) => {
    const { t, cut, includeSynthetic, report: r } = report(ctx);
    const fb = aggregateFeedback(cutSessions(t.id, cut.id, includeSynthetic), t.transcript, t.config.survey);
    const ai = store.getSummary(summaryKey(cut.id, includeSynthetic));
    return {
      auto: autoSummary(r, fb),
      ai: ai ? { ...ai, stale: ai.responses !== fb.responses } : null,
      aiAvailable: claudeAvailable(),
      responses: fb.responses,
    };
  });

  router.on('POST', '/api/tests/:id/summary', async (ctx) => {
    const { t, cut, includeSynthetic, report: r } = report(ctx);
    if (!claudeAvailable()) throw new HttpError(400, 'AI summaries need an Anthropic API key on the server (ANTHROPIC_API_KEY).');
    const fb = aggregateFeedback(cutSessions(t.id, cut.id, includeSynthetic), t.transcript, t.config.survey);
    if (!r.panel.valid && !fb.responses) throw new HttpError(400, 'There is no viewer data to summarise yet.');
    let content;
    try {
      content = await claudeSummary(summaryInput(t.title, t.description, r, fb));
    } catch (err) {
      console.error('Claude summary failed:', err);
      throw new HttpError(502, 'The AI summary could not be generated right now. The automatic summary is still shown.');
    }
    if (!content) throw new HttpError(502, 'The AI summary was not available for this data. The automatic summary is still shown.');
    store.saveSummary(summaryKey(cut.id, includeSynthetic), 'claude', fb.responses, content);
    return { ...store.getSummary(summaryKey(cut.id, includeSynthetic))!, stale: false };
  });

  const shortId = (id: string) => id.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase();

  /** Key presses and saves per session, for journey bars. */
  function journeys(cutId: string) {
    const map = new Map<string, { interest: number[]; bored: number[]; saves: { at: number; reason: string }[] }>();
    for (const e of store.journeyEvents(cutId)) {
      const j = map.get(e.session_id) ?? { interest: [], bored: [], saves: [] };
      if (e.type === 'interest') j.interest.push(Math.round(e.pt));
      else if (e.type === 'bored') j.bored.push(Math.round(e.pt));
      else j.saves.push({ at: Math.round(e.pt), reason: (e.data ? (JSON.parse(e.data) as { reason?: string }).reason : undefined) ?? 'other' });
      map.set(e.session_id, j);
    }
    return map;
  }

  router.on('GET', '/api/tests/:id/responses', (ctx) => {
    const u = d.requireUser(ctx);
    const { t, cut, includeSynthetic } = viewParams(ctx);
    const range = rangeFor(t.config, cut.resolved?.durationSec ?? 0);
    const j = journeys(cut.id);
    return cutSessions(t.id, cut.id, includeSynthetic)
      .filter((s) => s.status !== 'screened_out')
      .reverse()
      .map((s) => {
        const feedback = parseFeedback(s);
        return {
          id: shortId(s.id),
          sid: s.id,
          ...(u.role === 'admin' ? { pid: s.pid } : {}),
          status: s.status,
          valid: s.valid,
          excludeReason: s.exclude_reason,
          synthetic: !!s.synthetic,
          age_band: s.age_band,
          gender: s.gender,
          country: s.country,
          member: s.member,
          reached: s.max_pt,
          range,
          journey: j.get(s.id) ?? { interest: [], bored: [], saves: [] },
          startedAt: s.created_at,
          lastSeen: s.last_seen,
          feedbackAt: s.feedback_at,
          feedback,
          standoutLines: (feedback.standoutLines ?? []).map((i) => t.transcript[i]).filter(Boolean).map((c) => ({ start: c.start, text: c.text })),
        };
      });
  });

  // One viewer's own attention line, for the viewer detail panel.
  router.on('GET', '/api/tests/:id/viewers/:sid/attention', (ctx) => {
    d.requireUser(ctx);
    const t = d.getTestOr404(ctx.params.id);
    const s = store.getSession(ctx.params.sid);
    if (!s || s.test_id !== t.id) throw new HttpError(404, 'Viewer not found');
    const range = rangeFor(t.config, d.durationOf(s.cut_id));
    return { range, buckets: store.attentionBuckets(s.id, range.start, range.end, 120) };
  });

  // Where and why viewers stopped, and what happened at each attention drop.
  router.on('GET', '/api/tests/:id/dropoffs', (ctx) => {
    const { t, cut, includeSynthetic, report: r } = report(ctx);
    const range = r.range;
    const sessions = cutSessions(t.id, cut.id, includeSynthetic).filter((s) => s.status !== 'screened_out' && s.status !== 'started');
    const j = journeys(cut.id);
    const finished = (s: (typeof sessions)[number]) => s.status === 'watched' || s.status === 'completed' || s.max_pt >= range.end - 5;
    const stopped = sessions
      .filter((s) => !finished(s))
      .map((s) => ({ sid: s.id, id: shortId(s.id), at: Math.round(s.max_pt), status: s.status, reason: j.get(s.id)?.saves.at(-1)?.reason ?? null, who: { age_band: s.age_band, gender: s.gender, country: s.country, member: s.member }, lastSeen: s.last_seen }))
      .sort((a, b) => a.at - b.at);
    const BINS = 24;
    const width = (range.end - range.start) / BINS;
    const stopBins = Array.from({ length: BINS }, (_, i) => ({ start: range.start + i * width, end: range.start + (i + 1) * width, count: 0 }));
    for (const x of stopped) stopBins[Math.min(BINS - 1, Math.max(0, Math.floor((x.at - range.start) / width)))].count++;
    const reasons: Record<string, number> = {};
    let saves = 0;
    for (const s of sessions) for (const sv of j.get(s.id)?.saves ?? []) {
      saves++;
      reasons[sv.reason] = (reasons[sv.reason] ?? 0) + 1;
    }
    const fb = aggregateFeedback(sessions, t.transcript, t.config.survey);
    const ids = new Set(sessions.map((s) => s.id));
    const boredAll = [...j.entries()].filter(([id]) => ids.has(id)).flatMap(([, v]) => v.bored);
    const dropoffs = r.dropoffs.map((dr) => {
      const lo = dr.start - 15;
      const hi = dr.end + 15;
      return {
        ...dr,
        boredPresses: boredAll.filter((p) => p >= lo && p <= hi).length,
        stoppedHere: stopped.filter((x) => x.at >= lo && x.at <= hi).length,
        notes: fb.boredNotes.filter((q) => (q.at ?? -1) >= lo && (q.at ?? -1) <= hi),
      };
    });
    return {
      range,
      viewers: sessions.length,
      finished: sessions.filter(finished).length,
      stopped,
      stopBins,
      saves,
      reasons,
      dropoffs,
      boredNotes: fb.boredNotes,
      wouldCut: fb.wouldCut,
    };
  });

  router.on('GET', '/api/tests/:id/export/:format', (ctx) => {
    const { t, cut, report: r } = report(ctx);
    const fps = r.cut.fps;
    const fmt = ctx.params.format;
    const [body, type, ext] =
      fmt === 'csv' ? [toCsv(r.peaks, r.dropoffs, fps), 'text/csv', 'csv']
      : fmt === 'edl' ? [toEdl(t.title, r.peaks, r.dropoffs, fps), 'text/plain', 'edl']
      : fmt === 'xml' ? [toPremiereXml(t.title, r.cut.durationSec, r.peaks, r.dropoffs, fps), 'application/xml', 'xml']
      : [null, '', ''];
    if (body === null) throw new HttpError(404, 'Unknown export format');
    ctx.res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'content-disposition': `attachment; filename="${exportFilename(t.title, cut.label, ext)}"` }).end(body);
    return undefined;
  });

  router.on('GET', '/api/tests/:id/stream', async (ctx) => {
    const u = d.requireUser(ctx);
    const { cut } = viewParams(ctx);
    return d.streamFor(await d.freshCut(cut), `team:${u.id}`);
  });

  // ---- write: admins only ----

  router.on('POST', '/api/tests', async (ctx) => {
    const u = d.requireAdmin(ctx);
    const b = (await ctx.body()) as Record<string, unknown>;
    const title = str(b.title, 200);
    if (!title) throw new HttpError(400, 'Give the test a title.');
    const rawCuts = Array.isArray(b.cuts) ? (b.cuts as Record<string, unknown>[]).slice(0, 4) : [];
    if (!rawCuts.length) throw new HttpError(400, 'Add a video link.');
    const cuts = [];
    for (const [i, c] of rawCuts.entries()) {
      const url = str(c.url, 2000);
      let type;
      try {
        type = detectSourceType(url);
      } catch {
        throw new HttpError(400, `Video ${i + 1}: that is not a valid link.`);
      }
      try {
        const resolved = await resolveSource(type, url, { durationSec: Number(c.durationSec) || undefined, fps: Number(c.fps) || undefined, name: str(c.label, 100) }, d.fetchImpl);
        cuts.push({ label: str(c.label, 100) || `Cut ${String.fromCharCode(65 + i)}`, sourceType: type, sourceUrl: url, resolved });
      } catch (err) {
        throw new HttpError(400, `Video ${i + 1}: ${(err as Error).message}`);
      }
    }
    const transcript = typeof b.transcript === 'string' && b.transcript.trim() ? parseTranscript(b.transcript) : [];
    const test = store.createTest({ title, description: str(b.description, 2000), config: normalizeConfig(b.config), transcript, cuts });
    return testView(test, u.role === 'admin');
  });

  router.on('PATCH', '/api/tests/:id', async (ctx) => {
    d.requireAdmin(ctx);
    const t = d.getTestOr404(ctx.params.id);
    const b = (await ctx.body()) as Record<string, unknown>;
    const status = ['draft', 'live', 'closed'].includes(b.status as string) ? (b.status as TestRow['status']) : undefined;
    store.updateTest(t.id, {
      title: str(b.title, 200) || undefined,
      description: typeof b.description === 'string' ? str(b.description, 2000) : undefined,
      status,
      config: b.config ? normalizeConfig(b.config, t.config) : undefined,
      transcript: typeof b.transcript === 'string' ? parseTranscript(b.transcript) : undefined,
    });
    statsCache.delete(t.id);
    return testView(d.getTestOr404(t.id), true);
  });

  router.on('DELETE', '/api/tests/:id', (ctx) => {
    d.requireAdmin(ctx);
    store.deleteTest(d.getTestOr404(ctx.params.id).id);
    return { ok: true };
  });

  router.on('POST', '/api/tests/:id/simulate', async (ctx) => {
    d.requireAdmin(ctx);
    const t = d.getTestOr404(ctx.params.id);
    const b = (await ctx.body()) as { viewers?: number };
    const n = Math.round(num(b.viewers, 1, 2000, 200));
    const cuts = store.getCuts(t.id);
    let made = 0;
    for (const cut of cuts) made += simulatePanel(store, t, cut, Math.ceil(n / cuts.length));
    return { created: made };
  });

  router.on('DELETE', '/api/tests/:id/synthetic', (ctx) => {
    d.requireAdmin(ctx);
    return { deleted: store.deleteSyntheticSessions(d.getTestOr404(ctx.params.id).id) };
  });
}
