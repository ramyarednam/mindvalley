import { esc, icon } from '/shared/ui.js';

const root = document.getElementById('root');
const val = (id) => document.getElementById(id).value;
const showErr = (ex) => {
  const el = document.getElementById('err');
  el.textContent = ex.message;
  el.classList.remove('hidden');
};
export const app = { user: null, cleanup: [] };
export const onCleanup = (fn) => app.cleanup.push(fn);
export const isAdmin = () => app.user?.role === 'admin';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    app.user = null;
    route();
    throw new Error('Please sign in.');
  }
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

export function go(hash) {
  location.hash = hash;
}

// ---------- shell ----------

function initials(name) {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function shell(active) {
  const admin = isAdmin();
  const nav = (href, ic, label, key) => `<a href="${href}" class="${active === key ? 'on' : ''}">${icon(ic)}${label}</a>`;
  root.innerHTML = `
    <div class="shell">
      <aside class="side">
        <a class="logo" href="#/"><span class="logo-mark">${icon('play', 14)}</span>Pre-Watch</a>
        <nav class="nav">
          ${nav('#/', 'home', 'Dashboard', 'dashboard')}
          ${admin ? nav('#/new', 'plus', 'New screening', 'new') : ''}
          ${admin ? `<div class="nav-label">Admin</div>${nav('#/team', 'users', 'Team', 'team')}` : ''}
          <div class="nav-label">You</div>
          ${nav('#/account', 'user', 'Account', 'account')}
        </nav>
        <div class="me">
          <span class="avatar">${esc(initials(app.user.name))}</span>
          <div class="grow"><div class="me-name">${esc(app.user.name)}</div><span class="pill ${admin ? 'admin' : 'plain'}">${admin ? 'Admin' : 'Member'}</span></div>
          <button class="btn-ghost btn-sm" id="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button>
        </div>
      </aside>
      <main class="main" id="view"></main>
    </div>`;
  document.getElementById('logout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    app.user = null;
    go('#/');
    route();
  };
  return document.getElementById('view');
}

// ---------- auth pages ----------

function authLayout(formHtml) {
  root.innerHTML = `
    <div class="auth">
      <section class="auth-art">
        <div class="logo" style="color:#fff;padding:0"><span class="logo-mark" style="background:rgba(255,255,255,.2)">${icon('play', 14)}</span>Pre-Watch</div>
        <div style="position:relative;z-index:1">
          <h1>Know what holds attention before you hit publish.</h1>
          <p>Screen episodes with a real audience, see second by second where they lean in and drift off, and hear in their own words what to put in the title.</p>
        </div>
        <div class="auth-points">
          <div class="auth-point"><span>👀</span>Webcam attention, measured privately on each viewer's device</div>
          <div class="auth-point"><span>✨</span>Spacebar moments and standout lines become your hooks</div>
          <div class="auth-point"><span>🧠</span>Summaries the whole team can act on</div>
        </div>
      </section>
      <section class="auth-form">${formHtml}</section>
    </div>`;
}

function renderLogin() {
  authLayout(`
    <form id="login" class="rise">
      <h1>Welcome back</h1>
      <p class="muted">Sign in to see your screenings.</p>
      <div class="field"><label for="email">Work email</label><input id="email" type="email" autocomplete="email" required /></div>
      <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required /></div>
      <p id="err" class="error hidden"></p>
      <button class="btn-primary btn-lg" style="width:100%" type="submit">Sign in</button>
      <p class="faint small" style="margin-top:18px">No account? Ask an admin on your team to add you.</p>
    </form>`);
  document.getElementById('login').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const out = await api('/api/auth/login', { method: 'POST', body: { email: val('email'), password: val('pw') } });
      app.user = out.user;
      route();
    } catch (ex) {
      showErr(ex);
    }
  };
}

function renderSetup() {
  authLayout(`
    <form id="setup" class="rise">
      <span class="pill admin">First-time setup</span>
      <h1 style="margin-top:12px">Create the admin account</h1>
      <p class="muted">You'll be able to add screenings and invite your team. The setup code is printed in the server log (the terminal where Pre-Watch started).</p>
      <div class="field"><label for="code">Setup code</label><input id="code" type="text" inputmode="numeric" autocomplete="one-time-code" required /></div>
      <div class="field"><label for="name">Your name</label><input id="name" type="text" autocomplete="name" required /></div>
      <div class="field"><label for="email">Work email</label><input id="email" type="email" autocomplete="email" required /></div>
      <div class="field"><label for="pw">Password <span class="hint">at least 8 characters</span></label><input id="pw" type="password" autocomplete="new-password" minlength="8" required /></div>
      <p id="err" class="error hidden"></p>
      <button class="btn-grad btn-lg" style="width:100%" type="submit">Create account</button>
    </form>`);
  document.getElementById('setup').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const out = await api('/api/auth/setup', { method: 'POST', body: { setupCode: val('code').trim(), name: val('name'), email: val('email'), password: val('pw') } });
      app.user = out.user;
      route();
    } catch (ex) {
      showErr(ex);
    }
  };
}

// ---------- router ----------

export async function route() {
  for (const fn of app.cleanup) fn();
  app.cleanup = [];
  if (!app.user) {
    const me = await fetch('/api/me').then((r) => r.json());
    if (me.needsSetup) return renderSetup();
    if (!me.user) return renderLogin();
    app.user = me.user;
  }
  const [, page = '', id, tab] = (location.hash || '#/').slice(1).split('/');
  const view = shell(page === '' ? 'dashboard' : page === 'test' ? 'dashboard' : page);
  try {
    if (page === 'new' && isAdmin()) return (await import('/app/pages/new.js')).render(view);
    if (page === 'team' && isAdmin()) return (await import('/app/pages/team.js')).render(view);
    if (page === 'account') return (await import('/app/pages/account.js')).render(view);
    if (page === 'test' && id) return (await import('/app/pages/test.js')).render(view, id, tab || 'summary');
    return (await import('/app/pages/dashboard.js')).render(view);
  } catch (err) {
    if (err.message !== 'Please sign in.') view.innerHTML = `<div class="card empty"><div class="big">😕</div><h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p><a class="btn" href="#/">Back to dashboard</a></div>`;
  }
}

addEventListener('hashchange', route);
route();
