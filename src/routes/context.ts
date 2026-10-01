import type { IncomingMessage } from 'node:http';
import { config } from '../config.ts';
import type { Store } from '../db.ts';
import { HttpError, parseCookies, type Ctx } from '../http.ts';
import { makeToken, readToken } from '../signing.ts';
import { RESOLVE_MAX_AGE_MS, resolveSource } from '../sources/index.ts';
import type { CutRow, TestRow, UserRow } from '../types.ts';

export const SESSION_COOKIE = 'pw_session';
const SESSION_DAYS = 14;

export type Deps = ReturnType<typeof makeDeps>;

export function makeDeps(store: Store, fetchImpl: typeof fetch) {
  const currentUser = (req: IncomingMessage): UserRow | undefined => {
    const t = readToken<{ uid: string }>(parseCookies(req)[SESSION_COOKIE]);
    return t ? store.getUser(t.uid) : undefined;
  };

  return {
    store,
    fetchImpl,
    currentUser,

    requireUser(ctx: Ctx): UserRow {
      const u = currentUser(ctx.req);
      if (!u) throw new HttpError(401, 'Please sign in.');
      return u;
    },

    requireAdmin(ctx: Ctx): UserRow {
      const u = currentUser(ctx.req);
      if (!u) throw new HttpError(401, 'Please sign in.');
      if (u.role !== 'admin') throw new HttpError(403, 'Only admins can do that.');
      return u;
    },

    signIn(ctx: Ctx, user: UserRow): void {
      const token = makeToken({ uid: user.id }, SESSION_DAYS * 86400);
      const secure = ctx.req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      ctx.res.setHeader('set-cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`);
      store.updateUser(user.id, { last_login: Date.now() });
    },

    signOut(ctx: Ctx): void {
      ctx.res.setHeader('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    },

    getTestOr404(id: string): TestRow {
      const t = store.getTest(id);
      if (!t) throw new HttpError(404, 'Test not found');
      return t;
    },

    cutFor(test: TestRow, cutId: string | null): CutRow {
      const cuts = store.getCuts(test.id);
      const cut = cuts.find((c) => c.id === cutId) ?? cuts[0];
      if (!cut) throw new HttpError(404, 'This test has no video');
      return cut;
    },

    durationOf(cutId: string): number {
      return store.getCut(cutId)?.resolved?.durationSec ?? 0;
    },

    /** Returns a cut whose signed upstream URL is fresh enough to stream. */
    async freshCut(cut: CutRow): Promise<CutRow> {
      if (cut.resolved && (cut.source_type !== 'dropbox_replay' || Date.now() - cut.resolved.resolvedAt < RESOLVE_MAX_AGE_MS)) return cut;
      const resolved = await resolveSource(cut.source_type, cut.source_url, { durationSec: cut.resolved?.durationSec, fps: cut.resolved?.fps, name: cut.resolved?.name }, fetchImpl);
      store.setCutResolved(cut.id, resolved);
      return { ...cut, resolved };
    },

    streamFor(cut: CutRow, subject: string) {
      const k = makeToken({ cut: cut.id, sub: subject }, config.streamTokenTtlSec);
      const kind = cut.resolved?.kind ?? 'hls';
      return { kind, src: kind === 'hls' ? `/stream/${cut.id}/master.m3u8?k=${encodeURIComponent(k)}` : `/stream/${cut.id}/video.mp4?k=${encodeURIComponent(k)}` };
    },
  };
}
