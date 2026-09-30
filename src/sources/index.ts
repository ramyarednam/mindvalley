import type { ResolvedSource, SourceType } from '../types.ts';
import { parseReplayToken, resolveReplay } from './dropboxReplay.ts';

type FetchLike = typeof fetch;

export function detectSourceType(url: string): SourceType {
  if (parseReplayToken(url)) return 'dropbox_replay';
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith('.m3u8')) return 'hls';
  return 'mp4';
}

/**
 * Turns a studio-supplied link into something the proxy can stream.
 * Direct links need a duration, which we cannot read without decoding, so the studio passes it in.
 */
export async function resolveSource(
  type: SourceType,
  url: string,
  opts: { durationSec?: number; fps?: number; name?: string } = {},
  fetchImpl: FetchLike = fetch,
): Promise<ResolvedSource> {
  if (type === 'dropbox_replay') return resolveReplay(url, fetchImpl);
  if (!opts.durationSec || opts.durationSec <= 0) throw new Error('Duration (seconds) is required for direct HLS/MP4 links');
  return {
    name: opts.name || new URL(url).pathname.split('/').pop() || 'Video',
    durationSec: opts.durationSec,
    fps: opts.fps || 25,
    mediaUrl: url,
    kind: type === 'hls' ? 'hls' : 'mp4',
    resolvedAt: Date.now(),
  };
}

/** Signed Replay URLs expire; refresh ones older than this before handing out a stream. */
export const RESOLVE_MAX_AGE_MS = 30 * 60 * 1000;
