import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.ts';

export function sign(payload: string, secret = config.secret): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function verify(payload: string, signature: string, secret = config.secret): boolean {
  const expected = Buffer.from(sign(payload, secret));
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** A compact expiring token: base64url(json).signature */
export function makeToken(data: Record<string, unknown>, ttlSec: number, secret = config.secret): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function readToken<T extends Record<string, unknown>>(token: string | null | undefined, secret = config.secret): T | undefined {
  if (!token) return undefined;
  const [body, sig] = token.split('.');
  if (!body || !sig || !verify(body, sig, secret)) return undefined;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { exp: number };
    if (data.exp < Date.now() / 1000) return undefined;
    return data;
  } catch {
    return undefined;
  }
}
