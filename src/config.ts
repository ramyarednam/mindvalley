import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dataDir = resolve(process.env.PREWATCH_DATA_DIR ?? join(root, 'data'));
mkdirSync(dataDir, { recursive: true });

/** Signing secret: env first, else a random one persisted in the data dir. */
function loadSecret(): string {
  if (process.env.PREWATCH_SECRET) return process.env.PREWATCH_SECRET;
  const file = join(dataDir, 'secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const config = {
  root,
  publicDir: join(root, 'public'),
  dataDir,
  dbPath: process.env.PREWATCH_DB ?? join(dataDir, 'prewatch.db'),
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  secret: loadSecret(),
  /** Studio (internal team) password. Change it in any shared deployment. */
  studioPassword: process.env.STUDIO_PASSWORD ?? 'prewatch',
  /** Segment splits with fewer valid viewers than this are hidden (PRD SQ-7). */
  minSegmentViewers: Number(process.env.MIN_SEGMENT_VIEWERS ?? 50),
  /** Stream URLs handed to viewers expire after this many seconds. */
  streamTokenTtlSec: Number(process.env.STREAM_TOKEN_TTL_SEC ?? 6 * 3600),
  /** Upstream hosts the HLS/MP4 proxy may fetch from (SSRF guard). */
  allowedMediaHosts: (process.env.ALLOWED_MEDIA_HOSTS ?? '.previews.dropboxusercontent.com,.dropboxusercontent.com')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
  /** Optional override for the Dropbox Replay web client key ("id:secret"). Discovered automatically if unset. */
  replayClientAuth: process.env.DROPBOX_REPLAY_CLIENT_AUTH,
};

export function isAllowedMediaHost(hostname: string): boolean {
  return config.allowedMediaHosts.some((h) => (h.startsWith('.') ? hostname.endsWith(h) || hostname === h.slice(1) : hostname === h));
}
