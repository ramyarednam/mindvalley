import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as appConfig, isAllowedMediaHost } from './config.ts';
import type { Store } from './db.ts';
import { HttpError, Router, readBody, sendJson, serveStatic, type Ctx } from './http.ts';
import { decodeProxied, masterPlaylist, relay } from './hlsProxy.ts';
import { readToken } from './signing.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { makeDeps } from './routes/context.ts';
import { registerTestRoutes } from './routes/tests.ts';
import { registerViewerRoutes } from './routes/viewer.ts';

export { normalizeConfig, defaultConfig, screen, scheduleChecks } from './testConfig.ts';

export function createApp(store: Store, fetchImpl: typeof fetch = fetch) {
  const router = new Router();
  const d = makeDeps(store, fetchImpl);
  registerAuthRoutes(router, d);
  registerTestRoutes(router, d);
  registerViewerRoutes(router, d);

  // ---- video streaming through the signed proxy ----
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
    const stored = store.getCut(m[1]);
    if (!stored) throw new HttpError(404, 'Video not found');
    const cut = await d.freshCut(stored);
    if (m[2] === 'video.mp4') {
      await relay(req, res, cut.resolved!.mediaUrl, k, fetchImpl);
      return true;
    }
    let out = await masterPlaylist(cut.resolved!.mediaUrl, k, fetchImpl);
    if (out.status !== 200 && cut.source_type === 'dropbox_replay') {
      store.setCutResolved(cut.id, { ...cut.resolved!, resolvedAt: 0 });
      out = await masterPlaylist((await d.freshCut(store.getCut(cut.id)!)).resolved!.mediaUrl, k, fetchImpl);
    }
    if (out.status !== 200) {
      res.writeHead(502).end('Could not load the video source');
      return true;
    }
    res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-store' }).end(out.body);
    return true;
  }

  // ---- poster frames: Dropbox preview links expire, so fetch once and keep a copy ----
  const posterDir = join(appConfig.dataDir, 'posters');
  mkdirSync(posterDir, { recursive: true });
  async function handlePoster(res: ServerResponse, cutId: string): Promise<void> {
    const file = join(posterDir, `${cutId.replace(/[^\w-]/g, '')}.img`);
    if (!existsSync(file)) {
      const stored = store.getCut(cutId);
      if (!stored?.resolved?.posterUrl) throw new HttpError(404, 'No poster');
      const fetchPoster = async (url: string) => {
        const u = new URL(url);
        if (u.protocol !== 'https:' || !isAllowedMediaHost(u.hostname)) return null;
        const r = await fetchImpl(url);
        return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
      };
      let bytes = await fetchPoster(stored.resolved.posterUrl);
      if (!bytes && stored.source_type === 'dropbox_replay') {
        store.setCutResolved(stored.id, { ...stored.resolved, resolvedAt: 0 });
        const fresh = await d.freshCut(store.getCut(stored.id)!);
        bytes = fresh.resolved?.posterUrl ? await fetchPoster(fresh.resolved.posterUrl) : null;
      }
      if (!bytes) throw new HttpError(404, 'No poster');
      writeFileSync(file, bytes);
    }
    const bytes = readFileSync(file);
    const type = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : 'image/webp';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'private, max-age=86400' }).end(bytes);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'same-origin');
    try {
      if (url.pathname.startsWith('/stream/') && (await handleStream(req, res, url))) return;
      const poster = url.pathname.match(/^\/poster\/([\w-]+)$/);
      if (poster) return await handlePoster(res, poster[1]);
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
      if (url.pathname === '/' || url.pathname === '/app' || url.pathname.startsWith('/studio')) {
        res.writeHead(302, { location: '/app/' }).end();
        return;
      }
      const rel = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
      if (serveStatic(res, appConfig.publicDir, rel.slice(1))) return;
      // Panel links look like /watch/<testId>; any path that is not a real file there gets the viewer app.
      if (/^\/watch\/[^/.]+\/?$/.test(url.pathname) && serveStatic(res, appConfig.publicDir, 'watch/index.html')) return;
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
