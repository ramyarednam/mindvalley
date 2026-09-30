import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { isAllowedMediaHost } from './config.ts';
import { sign, verify } from './signing.ts';

/**
 * Same-origin HLS/MP4 proxy.
 * - Upstream hosts (Dropbox previews) send no CORS headers for our origin, so the browser cannot fetch them directly.
 * - Panelists never see the upstream URL; every rewritten URI is HMAC-signed and bound to their stream token (PRD TS-8).
 */

export function proxiedUri(upstream: string, streamToken: string): string {
  const u = Buffer.from(upstream).toString('base64url');
  return `/stream/p?u=${u}&h=${sign(`${u}|${streamToken}`)}&k=${encodeURIComponent(streamToken)}`;
}

export function decodeProxied(u: string | null, h: string | null, streamToken: string): string | undefined {
  if (!u || !h || !verify(`${u}|${streamToken}`, h)) return undefined;
  return Buffer.from(u, 'base64url').toString();
}

/** Rewrites every URI in a playlist (plain lines and URI="..." attributes) to go through the proxy. */
export function rewritePlaylist(text: string, baseUrl: string, streamToken: string): string {
  const abs = (ref: string) => new URL(ref, baseUrl).toString();
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_m, ref: string) => `URI="${proxiedUri(abs(ref), streamToken)}"`);
      }
      return proxiedUri(abs(trimmed), streamToken);
    })
    .join('\n');
}

function isPlaylist(url: string, contentType: string | null): boolean {
  return /mpegurl/i.test(contentType ?? '') || new URL(url).pathname.endsWith('.m3u8');
}

/** Fetches an upstream media URL and relays it; playlists are rewritten, everything else is streamed with Range support. */
export async function relay(req: IncomingMessage, res: ServerResponse, upstream: string, streamToken: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const url = new URL(upstream);
  if (url.protocol !== 'https:' || !isAllowedMediaHost(url.hostname)) {
    res.writeHead(403).end('Upstream host not allowed');
    return;
  }
  const headers: Record<string, string> = {};
  if (req.headers.range) headers.range = req.headers.range;
  const up = await fetchImpl(upstream, { headers });
  if (!up.ok && up.status !== 206) {
    res.writeHead(up.status === 403 || up.status === 404 || up.status === 410 ? 410 : 502, { 'content-type': 'text/plain' }).end(`Upstream ${up.status}`);
    return;
  }
  if (isPlaylist(upstream, up.headers.get('content-type'))) {
    const body = rewritePlaylist(await up.text(), upstream, streamToken);
    res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-store' }).end(body);
    return;
  }
  const out: Record<string, string> = { 'cache-control': 'private, max-age=3600' };
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = up.headers.get(h);
    if (v) out[h] = v;
  }
  res.writeHead(up.status, out);
  if (!up.body) {
    res.end();
    return;
  }
  const stream = Readable.fromWeb(up.body as import('node:stream/web').ReadableStream);
  req.on('close', () => stream.destroy());
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

/** Rewrites a master playlist fetched from the resolved source. */
export async function masterPlaylist(mediaUrl: string, streamToken: string, fetchImpl: typeof fetch = fetch): Promise<{ status: number; body: string }> {
  const up = await fetchImpl(mediaUrl);
  if (!up.ok) return { status: up.status, body: '' };
  return { status: 200, body: rewritePlaylist(await up.text(), mediaUrl, streamToken) };
}
