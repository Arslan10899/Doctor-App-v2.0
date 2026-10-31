/* ==========================================================================
   Doctor Application – Storage Settings page
   Two separate boxes: R2 (videos) and Cloudinary (images).
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
      document.getElementById('fSecret').placeholder = r2.secret_set ? 'Leave blank to keep current (' + (r2.secret || '••••') + ')' : 'Paste secret access key';
      document.getElementById('fBucket').value = r2.bucket || 'drapp-media';
      document.getElementById('fPublic').value = r2.public_base || '';
      document.getElementById('secretHint').textContent = r2.secret_set
        ? 'Current secret: ' + (r2.secret || '••••') + ' (masked). Leave blank to keep.'
        : 'No secret set yet.';
      updateR2Status(s.r2_active);

      const cld = s.cloudinary || {};
      document.getElementById('cEnabled').checked = !!cld.enabled;
      document.getElementById('cCloudName').value = cld.cloud_name || '';
      document.getElementById('cApiKey').value = cld.api_key || '';
      document.getElementById('cApiSecret').value = '';
      document.getElementById('cApiSecret').placeholder = cld.secret_set ? 'Leave blank to keep current (' + (cld.api_secret || '••••') + ')' : 'Paste API secret';
      document.getElementById('cFolder').value = cld.folder || 'doctor-application';
      document.getElementById('cSecretHint').textContent = cld.secret_set
        ? 'Current secret: ' + (cld.api_secret || '••••') + ' (masked). Leave blank to keep.'
        : 'No secret set yet.';
      updateCldStatus(s.cloudinary_active);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function updateR2Status(active) {
    const badge = document.getElementById('r2StatusBadge');
    const info = document.getElementById('r2StatusInfo');
    if (active) {
      badge.textContent = 'R2 active';
      badge.className = 'badge badge-success';
      info.textContent = 'Connection OK — R2 configured and reachable.';
      info.style.color = 'var(--success)';
    } else {
      badge.textContent = 'R2 inactive';
      badge.className = 'badge badge-secondary';
      info.textContent = 'Not active — fill all fields and Save, then Test connection.';
      info.style.color = 'var(--muted-foreground)';
    }
  }

  function updateCldStatus(active) {
    const badge = document.getElementById('cldStatusBadge');
    const info = document.getElementById('cldStatusInfo');
    if (active) {
      badge.textContent = 'Cloudinary active';
      badge.className = 'badge badge-success';
      info.textContent = 'Connection OK — Cloudinary configured.';
      info.style.color = 'var(--success)';
    } else {
      badge.textContent = 'Cloudinary inactive';
      badge.className = 'badge badge-secondary';
      info.textContent = 'Not active — fill all fields and Save, then Test connection.';
      info.style.color = 'var(--muted-foreground)';
    }
  }

  async function saveR2() {
    const btn = document.getElementById('saveR2Btn');
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
      updateR2Status(res.r2_active);
      if (res.r2_active) toast('R2 settings saved — active', 'success');
      else toast('R2 saved but not active — check fields', 'warning');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save R2';
    }
  }

  async function testR2() {
    const btn = document.getElementById('testR2Btn');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    try {
      const u = await Api.cloudStorageUsage();
      if (u.r2_enabled && u.r2_ok) {
        updateR2Status(true);
        document.getElementById('r2StatusInfo').textContent =
          'Connection OK — ' + (u.r2_objects || 0) + ' objects, ' + ((u.r2_total_bytes || 0) / 1024 / 1024).toFixed(2) + ' MB used.';
        toast('R2 connection successful', 'success');
      } else if (u.r2_enabled && !u.r2_ok) {
        updateR2Status(false);
        document.getElementById('r2StatusInfo').textContent = 'Connection failed: ' + (u.r2_error || 'unknown');
        toast('R2 connection failed', 'error');
      } else {
        updateR2Status(false);
        toast('R2 not enabled — save settings first', 'error');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test connection';
    }
  }

  async function saveCld() {
    const btn = document.getElementById('saveCldBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const payload = {
        cloudinary: {
          enabled: document.getElementById('cEnabled').checked,
          cloud_name: document.getElementById('cCloudName').value.trim(),
          api_key: document.getElementById('cApiKey').value.trim(),
          api_secret: document.getElementById('cApiSecret').value.trim(),
          folder: document.getElementById('cFolder').value.trim(),
        },
      };
      const res = await Api.saveStorageSettings(payload);
      updateCldStatus(res.cloudinary_active);
      if (res.cloudinary_active) toast('Cloudinary settings saved — active', 'success');
      else toast('Cloudinary saved but not active — check fields', 'warning');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Cloudinary';
    }
  }

  async function testCld() {
    const btn = document.getElementById('testCldBtn');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    try {
      const u = await Api.cloudinaryUsage();
      if (u.enabled && u.ok) {
        updateCldStatus(true);
        document.getElementById('cldStatusInfo').textContent =
          'Connection OK — ' + (u.objects || 0) + ' objects, ' + ((u.storage_used_bytes || 0) / 1024 / 1024).toFixed(2) + ' MB used.';
        toast('Cloudinary connection successful', 'success');
      } else if (u.enabled && !u.ok) {
        updateCldStatus(false);
        document.getElementById('cldStatusInfo').textContent = 'Connection failed: ' + (u.error || 'unknown');
        toast('Cloudinary connection failed', 'error');
      } else {
        updateCldStatus(false);
        toast('Cloudinary not enabled — save settings first', 'error');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test connection';
    }
  }

  function bind() {
    document.getElementById('saveR2Btn').addEventListener('click', saveR2);
    document.getElementById('testR2Btn').addEventListener('click', testR2);
    document.getElementById('saveCldBtn').addEventListener('click', saveCld);
    document.getElementById('testCldBtn').addEventListener('click', testCld);
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
