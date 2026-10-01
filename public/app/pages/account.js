import { esc, toast } from '/shared/ui.js';
import { api, app } from '/app/app.js';

export function render(view) {
  view.innerHTML = `
    <div class="page-head"><div><h1>Your account</h1><p class="muted">${esc(app.user.email)} · ${app.user.role === 'admin' ? 'Admin' : 'Member'}</p></div></div>
    <form class="card" id="pw-form" style="max-width:480px">
      <h3>Change password</h3>
      <div class="field"><label for="cur">Current password</label><input id="cur" type="password" autocomplete="current-password" required /></div>
      <div class="field"><label for="next">New password <span class="hint">at least 8 characters</span></label><input id="next" type="password" autocomplete="new-password" minlength="8" required /></div>
      <p id="pw-err" class="error hidden"></p>
      <button class="btn-primary" type="submit">Update password</button>
    </form>`;
  document.getElementById('pw-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/me/password', { method: 'POST', body: { current: document.getElementById('cur').value, next: document.getElementById('next').value } });
      toast('Password updated');
      e.target.reset();
    } catch (ex) {
      const el = document.getElementById('pw-err');
      el.textContent = ex.message;
      el.classList.remove('hidden');
    }
  };
}
