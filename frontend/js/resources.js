/* ==========================================================================
   Doctor Application – Resources Vault page
   Private list of hosting / database / ad / streaming accounts.
   Passwords are never sent by the list endpoint – revealed on demand.
   ========================================================================== */

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
    if (pwd !== '') payload.password = pwd;

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
    const slot = document.querySelector(`#pwd-${id} [data-slot="mask"]`);
    try {
      const res = await Api.revealResourcePassword(id);
      const pwd = res.password;
      if (pwd == null) {
        toast('Could not decrypt – vault key missing or wrong', 'error');
        return;
      }
      if (slot) slot.textContent = pwd;
      setTimeout(() => { if (slot) slot.textContent = '••••••••'; }, 12000);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function copyPassword(id) {
    try {
      const res = await Api.revealResourcePassword(id);
      if (res.password == null) { toast('Could not decrypt – vault key missing', 'error'); return; }
      await copyText(res.password);
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

  function init() {
    bind();
    load();
  }

  return { init, load };
})();

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', Resources.init)
  : Resources.init();
