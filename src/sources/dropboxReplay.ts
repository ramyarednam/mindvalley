import { config } from '../config.ts';
import type { ResolvedSource } from '../types.ts';

/**
 * Resolves a Dropbox Replay share link (https://replay.dropbox.com/share/<token>) to its HLS master playlist.
 *
 * Replay has no public API for this. We make the same call the Replay web player makes for an anonymous viewer
 * (reel/get_with_shared_link), authenticated with the public web-client key that Replay ships in its JS bundle.
 * The key is discovered at runtime and cached, or can be set with DROPBOX_REPLAY_CLIENT_AUTH="id:secret".
 * The returned playlist URLs are signed and expire, so callers should re-resolve when playback fails.
 */

const REPLAY_ORIGIN = 'https://replay.dropbox.com';
const API = 'https://api.dropboxapi.com/2/reel/get_with_shared_link';

type FetchLike = typeof fetch;

let cachedAuth: string | undefined;

export function parseReplayToken(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.hostname !== 'replay.dropbox.com') return undefined;
    const m = u.pathname.match(/^\/share\/([A-Za-z0-9_-]+)/);
    return m?.[1];
  } catch {
    return undefined;
  }
}

/** Finds the web client id/secret pair in the Replay app bundle. */
export async function discoverClientAuth(fetchImpl: FetchLike = fetch): Promise<string> {
  if (config.replayClientAuth) return Buffer.from(config.replayClientAuth).toString('base64');
  if (cachedAuth) return cachedAuth;
  const html = await (await fetchImpl(`${REPLAY_ORIGIN}/`)).text();
  const scripts = [...html.matchAll(/src="(\/static\/index-[^"]+\.js)"/g)].map((m) => m[1]);
  for (const path of scripts) {
    const js = await (await fetchImpl(`${REPLAY_ORIGIN}${path}`)).text();
    const found = extractClientAuth(js);
    if (found) {
      cachedAuth = Buffer.from(found).toString('base64');
      return cachedAuth;
    }
  }
  throw new Error('Could not discover the Dropbox Replay client key; set DROPBOX_REPLAY_CLIENT_AUTH="id:secret"');
}

/** The bundle declares the pair as two adjacent 15-char string constants followed by the environment name. */
export function extractClientAuth(js: string): string | undefined {
  const m = js.match(/"([a-z0-9]{15})",\s*[\w$]+\s*=\s*"([a-z0-9]{15})",\s*[\w$]+\s*=\s*"production"/);
  return m ? `${m[1]}:${m[2]}` : undefined;
}

export async function resolveReplay(shareUrl: string, fetchImpl: FetchLike = fetch): Promise<ResolvedSource> {
  const token = parseReplayToken(shareUrl);
  if (!token) throw new Error('Not a Dropbox Replay share link');
  const auth = await discoverClientAuth(fetchImpl);
  const res = await fetchImpl(API, {
    method: 'POST',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json', origin: REPLAY_ORIGIN },
    body: JSON.stringify({
      entity_id: '',
      entity_type: { '.tag': 'shared_video' },
      share_token: token,
      video_version_id: '',
      only_max_resolution: false,
      common: { replay_session_id: Math.random().toString(16).slice(2, 18) },
    }),
  });
  if (!res.ok) {
    cachedAuth = undefined;
    throw new Error(`Dropbox Replay returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return parseReplayResponse(await res.json());
}

export function parseReplayResponse(body: unknown): ResolvedSource {
  const e = (body as { shared_entity?: Record<string, unknown> }).shared_entity;
  if (!e) throw new Error('Unexpected Dropbox Replay response');
  if (e.requires_password) throw new Error('This Replay link is password protected');
  const mediaUrl = e.transcode_url as string | undefined;
  if (!mediaUrl) throw new Error('Replay has not finished transcoding this video yet');
  const meta = (e.video_metadata ?? {}) as Record<string, unknown>;
  return {
    name: (e.name as string) || (e.file_name as string) || 'Untitled',
    durationSec: Number(meta.duration_precise ?? meta.duration ?? 0),
    fps: Number(meta.frame_rate_precise ?? meta.frame_rate ?? 25) || 25,
    width: Number(meta.resolution_width) || undefined,
    height: Number(meta.resolution_height) || undefined,
    posterUrl: (e.poster_url as string) || undefined,
    mediaUrl,
    kind: 'hls',
    resolvedAt: Date.now(),
  };
}
