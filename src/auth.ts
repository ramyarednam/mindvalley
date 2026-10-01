import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';
import type { Store } from './db.ts';
import type { Role, UserRow } from './types.ts';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split(':');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const got = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, got);
}

export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Use at least 8 characters for the password.';
  if (pw.length > 200) return 'That password is too long.';
  return null;
}

export function normalizeEmail(email: unknown): string | null {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200 ? e : null;
}

/** Readable one-time password for new accounts, e.g. "maple-river-4821". */
export function temporaryPassword(): string {
  const words = ['maple', 'river', 'cedar', 'amber', 'orbit', 'lumen', 'coral', 'delta', 'ember', 'fable', 'harbor', 'indigo', 'juniper', 'lotus', 'meadow', 'nova', 'opal', 'prism', 'quartz', 'sierra', 'tidal', 'velvet', 'willow', 'zephyr'];
  const pick = () => words[randomBytes(1)[0] % words.length];
  return `${pick()}-${pick()}-${1000 + (randomBytes(2).readUInt16BE() % 9000)}`;
}

export function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.created_at, lastLogin: u.last_login };
}

/**
 * First-run setup: the first admin is created in the browser with a one-time setup code printed in the server log,
 * so a freshly deployed public server cannot be claimed by whoever finds it first.
 * ADMIN_EMAIL + ADMIN_PASSWORD create the first admin automatically instead.
 */
export function setupCode(): string {
  if (process.env.SETUP_CODE) return process.env.SETUP_CODE;
  const file = join(config.dataDir, 'setup-code');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const code = String(100000 + (randomBytes(3).readUIntBE(0, 3) % 900000));
  writeFileSync(file, code, { mode: 0o600 });
  return code;
}

export async function seedAdminFromEnv(store: Store): Promise<void> {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || store.countUsers() > 0) return;
  store.createUser({ email, name: process.env.ADMIN_NAME || 'Admin', role: 'admin', passHash: await hashPassword(password) });
  console.log(`Created admin account ${email} from ADMIN_EMAIL / ADMIN_PASSWORD.`);
}

export const ROLES: Role[] = ['admin', 'member'];

/** Simple in-memory limiter for sign-in attempts: 8 tries per 10 minutes per email+IP. */
const attempts = new Map<string, { n: number; until: number }>();
export function loginAllowed(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) return true;
  return a.n < 8;
}
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) attempts.set(key, { n: 1, until: now + 10 * 60 * 1000 });
  else a.n++;
}
export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
