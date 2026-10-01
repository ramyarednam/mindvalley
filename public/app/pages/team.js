import { ago, copyText, esc, icon, toast } from '/shared/ui.js';
import { api, app } from '/app/app.js';

function passwordModal(title, email, password) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal rise">
    <h2>${esc(title)}</h2>
    <p class="muted">Share this temporary password with <strong>${esc(email)}</strong>. They can change it under Account after signing in. It won't be shown again.</p>
    <div class="secret">${esc(password)}</div>
    <div class="row between"><button class="btn" id="copy-pw">${icon('copy', 15)} Copy sign-in details</button><button class="btn-primary" id="close-pw">Done</button></div>
  </div>`;
  document.body.append(bg);
  bg.querySelector('#copy-pw').onclick = () => copyText(`Pre-Watch: ${location.origin}/app/\nEmail: ${email}\nTemporary password: ${password}`);
  bg.querySelector('#close-pw').onclick = () => bg.remove();
}

export async function render(view) {
  const users = await api('/api/users');
  view.innerHTML = `
    <div class="page-head"><div><h1>Team</h1><p class="muted">Admins create and manage screenings. Members, such as editors and marketers, see every screening's results and summaries.</p></div></div>
    <div class="two">
      <div class="card">
        <div class="card-head"><h3>${users.length} people</h3></div>
        <table><thead><tr><th>Name</th><th>Role</th><th>Last sign-in</th><th></th></tr></thead><tbody>
        ${users
          .map(
            (u) => `<tr data-id="${esc(u.id)}">
              <td><strong>${esc(u.name)}</strong>${u.id === app.user.id ? ' <span class="faint tiny">(you)</span>' : ''}<div class="faint small">${esc(u.email)}</div></td>
              <td><select data-role style="width:auto" ${u.id === app.user.id ? 'disabled' : ''}><option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></td>
              <td class="faint small">${u.lastLogin ? ago(u.lastLogin) : 'Never'}</td>
              <td class="row" style="justify-content:flex-end">${u.id === app.user.id ? '' : `<button class="btn-ghost btn-sm" data-reset title="Reset password">${icon('lock', 15)}</button><button class="btn-ghost btn-sm btn-danger" data-remove title="Remove">${icon('trash', 15)}</button>`}</td>
            </tr>`,
          )
          .join('')}
        </tbody></table>
      </div>
      <form class="card" id="invite">
        <h3>${icon('plus', 16)} Add someone</h3>
        <div class="field"><label for="i-name">Name</label><input id="i-name" type="text" required /></div>
        <div class="field"><label for="i-email">Work email</label><input id="i-email" type="email" required /></div>
        <div class="field"><label>Role</label><div class="tabs-pills" id="i-role"><button type="button" data-r="member" class="on">Member</button><button type="button" data-r="admin">Admin</button></div>
          <p class="faint small" style="margin-top:8px" id="role-help">Can see all screenings, results and summaries.</p></div>
        <p id="i-err" class="error hidden"></p>
        <button class="btn-primary" type="submit">Add to team</button>
      </form>
    </div>`;

  let role = 'member';
  for (const b of view.querySelectorAll('[data-r]')) {
    b.onclick = () => {
      role = b.dataset.r;
      for (const o of view.querySelectorAll('[data-r]')) o.classList.toggle('on', o === b);
      document.getElementById('role-help').textContent = role === 'admin' ? 'Can also create screenings, change settings and manage the team.' : 'Can see all screenings, results and summaries.';
    };
  }
  document.getElementById('invite').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const out = await api('/api/users', { method: 'POST', body: { name: document.getElementById('i-name').value, email: document.getElementById('i-email').value, role } });
      passwordModal(`${out.user.name} is on the team`, out.user.email, out.temporaryPassword);
      render(view);
    } catch (ex) {
      const el = document.getElementById('i-err');
      el.textContent = ex.message;
      el.classList.remove('hidden');
    }
  };
  for (const tr of view.querySelectorAll('tr[data-id]')) {
    const id = tr.dataset.id;
    const u = users.find((x) => x.id === id);
    tr.querySelector('[data-role]')?.addEventListener('change', async (e) => {
      try {
        await api(`/api/users/${id}`, { method: 'PATCH', body: { role: e.target.value } });
        toast(`${u.name} is now ${e.target.value === 'admin' ? 'an admin' : 'a member'}`);
      } catch (ex) {
        toast(ex.message);
        render(view);
      }
    });
    tr.querySelector('[data-reset]')?.addEventListener('click', async () => {
      if (!confirm(`Reset ${u.name}'s password?`)) return;
      const out = await api(`/api/users/${id}`, { method: 'PATCH', body: { resetPassword: true } });
      passwordModal('New temporary password', u.email, out.temporaryPassword);
    });
    tr.querySelector('[data-remove]')?.addEventListener('click', async () => {
      if (!confirm(`Remove ${u.name} from the team?`)) return;
      await api(`/api/users/${id}`, { method: 'DELETE' });
      toast('Removed');
      render(view);
    });
  }
}
