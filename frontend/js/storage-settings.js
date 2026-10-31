/* ==========================================================================
   Doctor Application – Storage Settings page
   Configure Cloudflare R2 credentials from the panel.
   ========================================================================== */

const StorageSettings = (() => {
  async function load() {
    try {
      const s = await Api.storageSettings();
      const r2 = s.r2 || {};
      document.getElementById('fEnabled').checked = !!r2.enabled;
      document.getElementById('fAccount').value = r2.account_id || '';
      document.getElementById('fKey').value = r2.key_id || '';
      document.getElementById('fSecret').value = '';
      document.getElementById('fSecret').placeholder = r2.secret_set ? 'Leave blank to keep current (••••' + (r2.secret || '').slice(-4) + ')' : 'Paste secret access key';
      document.getElementById('fBucket').value = r2.bucket || 'drapp-media';
      document.getElementById('fPublic').value = r2.public_base || '';
      document.getElementById('secretHint').textContent = r2.secret_set
        ? 'Current secret: ' + (r2.secret || '••••') + ' (masked). Leave blank to keep.'
        : 'No secret set yet.';
      updateStatus(s.r2_active, s);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function updateStatus(active, s) {
    const badge = document.getElementById('statusBadge');
    const info = document.getElementById('statusInfo');
    if (active) {
      badge.textContent = 'R2 active';
      badge.className = 'badge badge-success';
      info.textContent = 'Connection OK — R2 is configured and reachable.';
      info.style.color = 'var(--success)';
    } else {
      badge.textContent = 'R2 inactive';
      badge.className = 'badge badge-secondary';
      const r2 = (s && s.r2) || {};
      const reasons = [];
      if (!r2.enabled) reasons.push('disabled');
      if (!r2.account_id) reasons.push('account_id missing');
      if (!r2.key_id) reasons.push('key_id missing');
      if (!r2.secret_set) reasons.push('secret missing');
      if (!r2.bucket) reasons.push('bucket missing');
      if (!r2.public_base) reasons.push('public_base missing');
      info.textContent = reasons.length ? 'Not active: ' + reasons.join(', ') + '.' : 'Config present but connection test failed.';
      info.style.color = 'var(--muted-foreground)';
    }
  }

  async function testConnection() {
    const btn = document.getElementById('testBtn');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    try {
      const u = await Api.cloudStorageUsage();
      if (u.r2_enabled && u.r2_ok) {
        updateStatus(true, { r2: {} });
        document.getElementById('statusInfo').textContent =
          'Connection OK — ' + (u.r2_objects || 0) + ' objects, ' + (u.r2_total_bytes ? (u.r2_total_bytes / 1024 / 1024).toFixed(2) : '0') + ' MB used.';
        toast('R2 connection successful', 'success');
      } else if (u.r2_enabled && !u.r2_ok) {
        updateStatus(false, { r2: {} });
        document.getElementById('statusInfo').textContent = 'Connection failed: ' + (u.r2_error || 'unknown');
        toast('R2 connection failed', 'error');
      } else {
        updateStatus(false, { r2: {} });
        toast('R2 not enabled — save settings first', 'error');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test connection';
    }
  }

  async function save() {
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const payload = {
        r2: {
          enabled: document.getElementById('fEnabled').checked,
          account_id: document.getElementById('fAccount').value.trim(),
          key_id: document.getElementById('fKey').value.trim(),
          secret: document.getElementById('fSecret').value.trim(),
          bucket: document.getElementById('fBucket').value.trim(),
          public_base: document.getElementById('fPublic').value.trim(),
        },
      };
      const res = await Api.saveStorageSettings(payload);
      if (res.r2_active) {
        toast('Settings saved — R2 is now active', 'success');
      } else {
        toast('Settings saved, but R2 not yet active — check fields', 'warning');
      }
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save settings';
    }
  }

  function bind() {
    document.getElementById('saveBtn').addEventListener('click', save);
    document.getElementById('testBtn').addEventListener('click', testConnection);
  }

  function init() {
    bind();
    load();
  }

  return { init, load };
})();

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', StorageSettings.init)
  : StorageSettings.init();
