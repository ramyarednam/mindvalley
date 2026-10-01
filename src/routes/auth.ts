import { checkPassword, clearLoginFailures, hashPassword, loginAllowed, normalizeEmail, publicUser, recordLoginFailure, ROLES, setupCode, temporaryPassword, validatePassword } from '../auth.ts';
import { HttpError, type Router } from '../http.ts';
import { str } from '../testConfig.ts';
import type { Role } from '../types.ts';
import type { Deps } from './context.ts';

export function registerAuthRoutes(router: Router, d: Deps): void {
  const { store } = d;

  router.on('GET', '/api/me', (ctx) => {
    const u = d.currentUser(ctx.req);
    return { user: u ? publicUser(u) : null, needsSetup: store.countUsers() === 0 };
  });

  // First admin account. Requires the one-time code printed in the server log.
  router.on('POST', '/api/auth/setup', async (ctx) => {
    if (store.countUsers() > 0) throw new HttpError(409, 'Setup is already done. Please sign in.');
    const b = (await ctx.body()) as Record<string, unknown>;
    if (str(b.setupCode, 20) !== setupCode()) throw new HttpError(403, 'That setup code is not right. Find it in the server log.');
    const email = normalizeEmail(b.email);
    if (!email) throw new HttpError(400, 'Enter a valid email address.');
    const pwError = validatePassword(b.password);
    if (pwError) throw new HttpError(400, pwError);
    const user = store.createUser({ email, name: str(b.name, 80) || email.split('@')[0], role: 'admin', passHash: await hashPassword(b.password as string) });
    d.signIn(ctx, user);
    return { user: publicUser(user) };
  });

  router.on('POST', '/api/auth/login', async (ctx) => {
    const b = (await ctx.body()) as Record<string, unknown>;
    const email = normalizeEmail(b.email) ?? '';
    const key = `${email}|${ctx.req.socket.remoteAddress}`;
    if (!loginAllowed(key)) throw new HttpError(429, 'Too many attempts. Wait 10 minutes and try again.');
    const user = email ? store.getUserByEmail(email) : undefined;
    if (!user || !(await checkPassword(String(b.password ?? ''), user.pass_hash))) {
      recordLoginFailure(key);
      throw new HttpError(401, 'That email and password do not match.');
    }
    clearLoginFailures(key);
    d.signIn(ctx, user);
    return { user: publicUser(user) };
  });

  router.on('POST', '/api/auth/logout', (ctx) => {
    d.signOut(ctx);
    return { ok: true };
  });

  router.on('POST', '/api/me/password', async (ctx) => {
    const u = d.requireUser(ctx);
    const b = (await ctx.body()) as Record<string, unknown>;
    if (!(await checkPassword(String(b.current ?? ''), u.pass_hash))) throw new HttpError(400, 'Your current password is not right.');
    const pwError = validatePassword(b.next);
    if (pwError) throw new HttpError(400, pwError);
    store.updateUser(u.id, { pass_hash: await hashPassword(b.next as string) });
    return { ok: true };
  });

  // ---- team management (admins) ----

  router.on('GET', '/api/users', (ctx) => {
    d.requireAdmin(ctx);
    return store.listUsers().map(publicUser);
  });

  router.on('POST', '/api/users', async (ctx) => {
    d.requireAdmin(ctx);
    const b = (await ctx.body()) as Record<string, unknown>;
    const email = normalizeEmail(b.email);
    if (!email) throw new HttpError(400, 'Enter a valid email address.');
    if (store.getUserByEmail(email)) throw new HttpError(409, 'Someone with that email is already on the team.');
    const role: Role = ROLES.includes(b.role as Role) ? (b.role as Role) : 'member';
    const password = temporaryPassword();
    const user = store.createUser({ email, name: str(b.name, 80) || email.split('@')[0], role, passHash: await hashPassword(password) });
    return { user: publicUser(user), temporaryPassword: password };
  });

  router.on('PATCH', '/api/users/:id', async (ctx) => {
    const me = d.requireAdmin(ctx);
    const target = store.getUser(ctx.params.id);
    if (!target) throw new HttpError(404, 'User not found');
    const b = (await ctx.body()) as Record<string, unknown>;
    const role = ROLES.includes(b.role as Role) ? (b.role as Role) : undefined;
    if (role && role !== 'admin' && target.role === 'admin' && store.listUsers().filter((u) => u.role === 'admin').length === 1) {
      throw new HttpError(400, 'The team needs at least one admin.');
    }
    if (role === 'member' && target.id === me.id) throw new HttpError(400, 'Ask another admin to change your own role.');
    store.updateUser(target.id, { name: str(b.name, 80) || undefined, role });
    let password: string | undefined;
    if (b.resetPassword === true) {
      password = temporaryPassword();
      store.updateUser(target.id, { pass_hash: await hashPassword(password) });
    }
    return { user: publicUser(store.getUser(target.id)!), temporaryPassword: password };
  });

  router.on('DELETE', '/api/users/:id', (ctx) => {
    const me = d.requireAdmin(ctx);
    if (ctx.params.id === me.id) throw new HttpError(400, 'You cannot remove yourself.');
    const target = store.getUser(ctx.params.id);
    if (!target) throw new HttpError(404, 'User not found');
    store.deleteUser(target.id);
    return { ok: true };
  });
}
