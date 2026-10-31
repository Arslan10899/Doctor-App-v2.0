/* ==========================================================================
   Doctor Application – Resources Vault page
   Private list of hosting / database / ad / streaming accounts.
   Passwords are AES-GCM encrypted in the browser (Web Crypto) using a
   passphrase stored in localStorage – the server and git repo never see
   plaintext.
   ========================================================================== */

const VaultCrypto = (() => {
  const PASS_KEY = 'doctor_app_vault_pass';
  const SALT = new TextEncoder().encode('doctor-app-vault-v1');

  async function getPassphrase() {
    let p = localStorage.getItem(PASS_KEY);
    if (p) return p;
    p = prompt('Vault passphrase set karein (yaad rakhein — bhoole to passwords recover nahi honge):');
    if (!p) throw new Error('Passphrase required');
    localStorage.setItem(PASS_KEY, p);
    return p;
  }

  async function deriveKey(pass) {
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(text) {
    if (!text) return '';
    const key = await deriveKey(await getPassphrase());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    const buf = new Uint8Array(iv.length + ct.byteLength);
    buf.set(iv);
    buf.set(new Uint8Array(ct), iv.length);
    return btoa(String.fromCharCode(...buf));
  }

  async function decrypt(enc) {
    if (!enc) return null;
    try {
      const key = await deriveKey(await getPassphrase());
      const buf = Uint8Array.from(atob(enc), (c) => c.charCodeAt(0));
      const iv = buf.slice(0, 12);
      const ct = buf.slice(12);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch (e) {
      return null;
    }
  }

  return { getPassphrase, encrypt, decrypt };
})();

const Resources = (() => {
  const state = {
    rows: [],
    editingId: null,
    query: '',
    category: '',
  };

  const CATEGORY_LABEL = {
    website: 'Website',
    database: 'Database',
    storage: 'Storage / CDN',
    video: 'Video service',
    images: 'Image service',
    social: 'Social / Ads',
    other: 'Other',
  };

  function escapeHtml(value) {
    return Utils.escape(String(value == null ? '' : value));
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.replace(' ', 'T'));
    if (isNaN(d)) return iso;
    const now = new Date();
    const diff = now - d;
    if (diff < 60 * 1000) return 'just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  async function load() {
    try {
      const rows = await Api.listResources({ q: state.query || undefined, category: state.category || undefined });
      state.rows = rows || [];
      render();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function render() {
    const host = document.getElementById('resourceRows');
    const empty = document.getElementById('emptyState');
    const count = document.getElementById('countInfo');
    if (!host) return;

    if (!state.rows.length) {
      host.innerHTML = '';
      empty.classList.remove('hidden');
      count.textContent = state.query || state.category ? 'No matches' : '0 resources';
      return;
    }
    empty.classList.add('hidden');

    host.innerHTML = state.rows.map((r) => `
      <tr data-id="${r.id}">
        <td>
          <div style="display:flex;flex-direction:column;gap:.15rem;">
            <span class="cell-strong">${escapeHtml(r.name)}</span>
            <span class="badge badge-secondary" style="align-self:flex-start;">${escapeHtml(CATEGORY_LABEL[r.category] || r.category || 'Other')}</span>
          </div>
        </td>
        <td style="max-width:14rem;">
          <div style="display:flex;flex-direction:column;gap:.15rem;">
            <span class="text-sm">${escapeHtml(r.purpose || '—')}</span>
            ${r.url ? `<a class="text-xs" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);word-break:break-all;">${escapeHtml(r.url)}</a>` : ''}
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:.35rem;">
            <code class="text-sm" style="word-break:break-all;">${escapeHtml(r.username || '—')}</code>
            ${r.username ? `<button class="btn btn-ghost btn-sm" data-action="copy-user" data-id="${r.id}" title="Copy username">${window.Icon('clipboard-list')}</button>` : ''}
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:.35rem;min-width:8rem;" id="pwd-${r.id}">
            <span class="text-sm text-muted" data-slot="mask">••••••••</span>
            ${r.has_password ? `
              <button class="btn btn-ghost btn-sm" data-action="reveal" data-id="${r.id}" title="Reveal password">${window.Icon('check-circle')}</button>
              <button class="btn btn-ghost btn-sm" data-action="copy-pwd" data-id="${r.id}" title="Copy password">${window.Icon('clipboard-list')}</button>
            ` : '<span class="text-xs text-muted">(none)</span>'}
          </div>
        </td>
        <td style="max-width:12rem;"><span class="text-sm" style="word-break:break-word;">${escapeHtml(r.comment || '—')}</span></td>
        <td><span class="text-xs text-muted">${escapeHtml(fmtDate(r.updated_at))}</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${r.id}" title="Edit">${window.Icon('pencil')}</button>
          <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${r.id}" title="Delete">${window.Icon('trash-2')}</button>
        </td>
      </tr>
    `).join('');

    count.textContent = `${state.rows.length} resource${state.rows.length === 1 ? '' : 's'}`;
  }

  function openModal(row) {
    state.editingId = row ? row.id : null;
    const title = document.getElementById('modalTitle');
    if (title) title.textContent = row ? 'Edit resource' : 'Add resource';

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; };
    set('fName', row ? row.name : '');
    set('fCategory', row ? (row.category || 'other') : 'other');
    set('fPurpose', row ? row.purpose : '');
    set('fUrl', row ? row.url : '');
    set('fUsername', row ? row.username : '');
    const pwd = document.getElementById('fPassword');
    if (pwd) { pwd.value = ''; }
    const label = document.getElementById('passwordLabel');
    if (label) label.textContent = row ? 'Password (blank = keep current)' : 'Password';
    set('fComment', row ? row.comment : '');

    document.getElementById('modalBackdrop').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modalBackdrop').classList.add('hidden');
    state.editingId = null;
  }

  async function save() {
    const name = document.getElementById('fName').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const payload = {
      name,
      category: document.getElementById('fCategory').value,
      purpose: document.getElementById('fPurpose').value.trim() || null,
      url: document.getElementById('fUrl').value.trim() || null,
      username: document.getElementById('fUsername').value.trim() || null,
      comment: document.getElementById('fComment').value.trim() || null,
    };
    const pwd = document.getElementById('fPassword').value;
    if (pwd !== '') {
      try {
        payload.password = await VaultCrypto.encrypt(pwd);
      } catch (e) {
        toast(e.message || 'Passphrase required', 'error');
        saveBtn.disabled = false;
        return;
      }
    }

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    try {
      if (state.editingId) {
        await Api.updateResource(state.editingId, payload);
        toast('Resource updated', 'success');
      } else {
        await Api.createResource(payload);
        toast('Resource added', 'success');
      }
      closeModal();
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function revealPassword(id) {
    const row = state.rows.find((r) => r.id === id);
    if (!row || !row.password_enc) return;
    const pwd = await VaultCrypto.decrypt(row.password_enc);
    if (pwd == null) { toast('Decrypt nahi hua – passphrase galat ho sakti hai', 'error'); return; }
    const slot = document.querySelector(`#pwd-${id} [data-slot="mask"]`);
    if (slot) slot.textContent = pwd;
    setTimeout(() => { if (slot) slot.textContent = '••••••••'; }, 12000);
  }

  async function copyPassword(id) {
    const row = state.rows.find((r) => r.id === id);
    if (!row || !row.password_enc) return;
    const pwd = await VaultCrypto.decrypt(row.password_enc);
    if (pwd == null) { toast('Decrypt nahi hua – passphrase galat ho sakti hai', 'error'); return; }
    try {
      await copyText(pwd);
      toast('Password copied', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function copyUsername(id) {
    const row = state.rows.find((r) => r.id === id);
    if (!row || !row.username) return;
    try {
      await copyText(row.username);
      toast('Username copied', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function removeRow(id) {
    const row = state.rows.find((r) => r.id === id);
    if (!row) return;
    if (!confirm(`Delete "${row.name}"?`)) return;
    try {
      await Api.deleteResource(id);
      toast('Resource deleted', 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function editRow(id) {
    const row = state.rows.find((r) => r.id === id);
    if (row) openModal(row);
  }

  function bind() {
    const search = document.getElementById('searchInput');
    if (search) {
      let timer = null;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.query = search.value.trim(); load(); }, 250);
      });
    }
    const cat = document.getElementById('categoryFilter');
    if (cat) cat.addEventListener('change', () => { state.category = cat.value; load(); });

    const addBtn = document.getElementById('addBtn');
    if (addBtn) addBtn.addEventListener('click', () => openModal(null));
    const closeBtn = document.getElementById('modalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.addEventListener('click', save);

    const rows = document.getElementById('resourceRows');
    if (rows) {
      rows.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = Number(btn.dataset.id);
        switch (btn.dataset.action) {
          case 'reveal': revealPassword(id); break;
          case 'copy-pwd': copyPassword(id); break;
          case 'copy-user': copyUsername(id); break;
          case 'edit': editRow(id); break;
          case 'delete': removeRow(id); break;
        }
      });
    }
  }

  function ensurePassphrase() {
    if (localStorage.getItem('doctor_app_vault_pass')) return true;
    const host = document.querySelector('.content-inner');
    if (!host || document.getElementById('passphraseBanner')) return false;
    const banner = document.createElement('div');
    banner.id = 'passphraseBanner';
    banner.className = 'card';
    banner.style.borderLeft = '3px solid var(--primary)';
    banner.innerHTML = `
      <div class="card-content" style="display:grid;gap:.6rem;">
        <div style="display:flex;gap:.5rem;align-items:center;">
          <span style="color:var(--primary);">${window.Icon('check-circle')}</span>
          <b>Vault passphrase set karein</b>
        </div>
        <div class="text-sm text-muted">Passwords encrypt karne ke liye ek passphrase chahiye. Ye sirf aap ke browser mein save hoti hai — server aur git repo kabhi nahi dekhte. Yaad rakhein, warna purane passwords recover nahi honge.</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <input class="input" id="ppInput" type="password" placeholder="Passphrase (min 4 chars)" style="max-width:22rem;" />
          <button type="button" class="btn btn-primary" id="ppSetBtn">Set passphrase</button>
        </div>
      </div>`;
    host.insertBefore(banner, host.firstChild);
    const addBtn = document.getElementById('addBtn');
    if (addBtn) { addBtn.disabled = true; addBtn.title = 'Pehle passphrase set karein'; }
    document.getElementById('ppSetBtn').addEventListener('click', () => {
      const v = document.getElementById('ppInput').value;
      if (!v || v.length < 4) { toast('Passphrase kam az kam 4 characters ki ho', 'error'); return; }
      localStorage.setItem('doctor_app_vault_pass', v);
      banner.remove();
      if (addBtn) { addBtn.disabled = false; addBtn.title = ''; }
      toast('Passphrase set ho gayi', 'success');
    });
    return false;
  }

  function init() {
    ensurePassphrase();
    bind();
    load();
  }

  return { init, load };
})();

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', Resources.init)
  : Resources.init();
