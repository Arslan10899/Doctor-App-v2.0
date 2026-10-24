/* ==========================================================================
   Doctor Application – account page (own profile details)
   - profile picture upload / remove
   - name + email update
   - password change (current password required)
   ========================================================================== */

const Account = (() => {
  let me = null;

  /* ---------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------- */
  function $(selector) {
    return document.querySelector(selector);
  }

  function showBox(id, message) {
    const box = $(id);
    if (!box) return;
    box.textContent = message;
    box.classList.remove('hidden');
  }

  function hideBox(id) {
    $(id)?.classList.add('hidden');
  }

  function formatDate(value) {
    if (!value) return '—';
    const parsed = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function refreshChrome() {
    /* The header + sidebar were rendered before the update; refresh them. */
    const headerAvatar = document.querySelector('#profileDropdown .header-avatar');
    if (headerAvatar) headerAvatar.innerHTML = Utils.avatar(me, 'avatar-sm');
  }

  function fillFields() {
    $('#accName').value = me.name || '';
    $('#accEmail').value = me.email || '';
    $('#accRole').value = me.role || 'admin';
    $('#accSince').value = formatDate(me.created_at);
    $('#accountId').textContent = me.id ?? '–';
    $('#factEmail').textContent = me.email || '–';
    $('#factRole').textContent = me.role || 'admin';
    $('#factId').textContent = `#${me.id ?? '–'}`;
    document.title = `Account · ${me.name || 'Admin'} · Doctor Application`;
    renderAvatar();
  }

  function renderAvatar() {
    const host = $('#accountAvatar');
    if (host) host.innerHTML = Utils.avatar(me, 'avatar-xl');
  }

  async function refreshFromServer() {
    me = await Api.me();
    Api.setUser(me);
    fillFields();
    refreshChrome();
  }

  /* ---------------------------------------------------------------------
   * Profile details
   * ------------------------------------------------------------------- */
  async function saveDetails(event) {
    event.preventDefault();
    hideBox('#detailsError');

    const name = $('#accName').value.trim();
    const email = $('#accEmail').value.trim();
    if (name.length < 2) {
      showBox('#detailsError', 'Name must be at least 2 characters.');
      return;
    }

    const button = $('#detailsSaveBtn');
    button.disabled = true;
    button.textContent = 'Saving…';

    try {
      me = await Api.updateMe({ name, email });
      Api.setUser(me);
      fillFields();
      refreshChrome();
      toast('Profile updated.', 'success');
    } catch (err) {
      showBox('#detailsError', err.message || 'Could not save your profile.');
    } finally {
      button.disabled = false;
      button.innerHTML =
        window.Icon('save') + ' Save details';
    }
  }

  /* ---------------------------------------------------------------------
   * Password
   * ------------------------------------------------------------------- */
  async function savePassword(event) {
    event.preventDefault();
    hideBox('#passwordError');

    const current = $('#accCurrentPassword').value;
    const next = $('#accNewPassword').value;
    const confirm = $('#accConfirmPassword').value;

    if (next.length < 6) {
      showBox('#passwordError', 'New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      showBox('#passwordError', 'New password and confirmation do not match.');
      return;
    }

    const button = $('#passwordSaveBtn');
    button.disabled = true;
    button.textContent = 'Updating…';

    try {
      await Api.changePassword(current, next);
      toast('Password updated. Use it next time you sign in.', 'success');
      clearPasswordFields();
    } catch (err) {
      showBox('#passwordError', err.message || 'Could not update the password.');
    } finally {
      button.disabled = false;
      button.innerHTML =
        window.Icon('lock') + ' Update password';
    }
  }

  function clearPasswordFields() {
    $('#accCurrentPassword').value = '';
    $('#accNewPassword').value = '';
    $('#accConfirmPassword').value = '';
    const input = $('#accNewPassword');
    input.type = 'password';
    setEyeIcon(false);
  }

  function setEyeIcon(visible) {
    const toggle = $('#toggleNewPassword');
    if (!toggle) return;
    toggle.innerHTML = window.Icon(visible ? 'eye-off' : 'eye');
    toggle.setAttribute('aria-label', visible ? 'Hide new password' : 'Show new password');
    toggle.title = visible ? 'Hide password' : 'Show password';
  }

  /* ---------------------------------------------------------------------
   * Profile picture
   * ------------------------------------------------------------------- */
  async function uploadAvatar(file) {
    if (!file) return;

    if (!/image\//.test(file.type || '')) {
      toast('Please choose an image file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image is larger than 5 MB.', 'error');
      return;
    }

    /* Optimistic preview from the local file. */
    const reader = new FileReader();
    reader.onload = (event) => {
      $('#accountAvatar').innerHTML =
        `<div class="avatar avatar-xl"><img src="${event.target.result}" alt="${Utils.escape(me.name || 'Admin')}"></div>`;
    };
    reader.readAsDataURL(file);

    toast('Uploading picture…', 'info');
    try {
      const result = await Api.uploadMyAvatar(file);
      me = { ...me, avatar_url: result.url };
      Api.setUser(me);
      $('#accountAvatar').innerHTML = Utils.avatar(me, 'avatar-xl');
      refreshChrome();
      toast('Profile picture updated.', 'success');
    } catch (err) {
      renderAvatar();
      toast(err.message || 'Upload failed.', 'error');
    }
  }

  async function removeAvatar() {
    try {
      me = await Api.updateMe({ name: me.name, email: me.email, avatar_url: '' });
      Api.setUser(me);
      fillFields();
      refreshChrome();
      toast('Profile picture removed. Initials are shown instead.', 'success');
    } catch (err) {
      toast(err.message || 'Could not remove the picture.', 'error');
    }
  }

  /* ---------------------------------------------------------------------
   * Sign out
   * ------------------------------------------------------------------- */
  function signOut() {
    Api.setToken('');
    Api.setUser(null);
    toast('Signed out.', 'info');
    setTimeout(() => {
      window.location.replace('login.html?v=23');
    }, 400);
  }

  /* ---------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------- */
  function bind() {
    $('#detailsForm')?.addEventListener('submit', saveDetails);
    $('#detailsReset')?.addEventListener('click', () => {
      fillFields();
      hideBox('#detailsError');
    });

    $('#passwordForm')?.addEventListener('submit', savePassword);
    $('#passwordReset')?.addEventListener('click', () => {
      clearPasswordFields();
      hideBox('#passwordError');
    });

    $('#toggleNewPassword')?.addEventListener('click', () => {
      const input = $('#accNewPassword');
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      setEyeIcon(visible);
    });

    $('#myAvatarInput')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) uploadAvatar(file).then(() => {
        event.target.value = '';
      });
    });

    $('#removePicture')?.addEventListener('click', removeAvatar);
    $('#signOutHereBtn')?.addEventListener('click', signOut);
  }

  async function init() {
    bind();

    try {
      me = await Api.me();
      Api.setUser(me);
      fillFields();
    } catch (err) {
      /* Layout.refreshChrome already bounced us to login; stop quietly. */
      return;
    }
  }

  return { init };
})();

window.Account = Account;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', Account.init)
  : Account.init();
