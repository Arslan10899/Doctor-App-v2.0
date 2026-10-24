/* ==========================================================================
   Doctor Application – Notifications page
   Two kinds of content:
     • origin 'backup' – the push history imported from the local backup
       (read-only, never deletable)
     • origin 'panel'  – notifications the admin composes here; they are
       stored locally until FCM is plugged in, and a backup re-import
       never removes them
   ========================================================================== */

const Notifications = (() => {
  let all = [];
  let search = '';
  let deleteArmedId = null; /* two-step delete on panel-sent cards */

  const $ = (s) => document.querySelector(s);

  /* "2026-08-08 07:10:41.088000+00:00" -> readable date/time.
     A plain new Date() is unreliable with the 6-digit microseconds,
     so normalise the string first. */
  function formatSent(value) {
    if (!value) return null;
    const m = String(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
    if (!m) return null;
    return Utils.formatDateTime(`${m[1]}T${m[2]}`);
  }

  function card(n) {
    const image = n.image_url && /^https?:\/\//.test(n.image_url)
      ? `<img class="notif-image" src="${Utils.escape(n.image_url)}" alt="" loading="lazy"
            onerror="this.remove()" />`
      : '';
    const sent = formatSent(n.sent_at);
    const isPanel = n.origin === 'panel';

    const chip = isPanel
      ? `<span class="notif-source">${window.Icon('megaphone')} Sent from panel</span>`
      : `<span class="notif-type">${Utils.escape(n.type || 'info')}</span>`;

    /* the backup history stays read-only – only panel rows can be removed */
    const actions = isPanel
      ? `<span class="notif-actions">
           <button type="button" class="notif-delete" data-act="delete" data-id="${n.id}"
                   title="Delete this notification" aria-label="Delete notification">
             ${window.Icon('trash-2')}
           </button>
         </span>`
      : '';

    return `
      <article class="notif-card ${isPanel ? 'is-panel' : ''}">
        <div class="notif-top">
          <div class="notif-title">${Utils.escape(n.title || '—')}</div>
          <div class="notif-top-side">${chip}${actions}</div>
        </div>
        ${n.description ? `<div class="notif-desc">${Utils.escape(n.description)}</div>` : ''}
        ${image}
        <div class="notif-date">
          ${window.Icon('clock')}
          <span>${sent ? Utils.escape(sent) : 'Unknown date'}</span>
          ${n.admin_name ? `<span>· by ${Utils.escape(n.admin_name)}</span>` : ''}
          ${isPanel ? '<span>· not yet delivered to FCM</span>' : ''}
        </div>
      </article>
    `;
  }

  function render() {
    /* re-apply the confirm state of the two-step delete after a re-render */
    const q = search.trim().toLowerCase();
    const rows = all.filter((n) => !q || `${n.title || ''} ${n.description || ''} ${n.type || ''}`.toLowerCase().includes(q));

    $('#notifGrid').innerHTML = rows.map(card).join('');
    wireDeleteButtons();
    $('#notifEmpty').classList.toggle('hidden', rows.length > 0);
    $('#resultsInfo').textContent = `${rows.length} of ${all.length} notifications`;
  }

  /* ---------------------------------------------------------------------
   * Two-step delete (panel rows only): first click arms the button,
   * second click within the same spot confirms it.
   * ------------------------------------------------------------------- */
  function wireDeleteButtons() {
    document.querySelectorAll('.notif-delete[data-act="delete"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (deleteArmedId !== id) {
          /* arm it */
          btn.classList.add('is-confirm');
          btn.innerHTML = 'Confirm?';
          deleteArmedId = id;
          setTimeout(() => {
            if (deleteArmedId === id) {
              deleteArmedId = null;
              render();
            }
          }, 3500);
          return;
        }
        try {
          await Api.deleteNotification(id);
          all = all.filter((n) => n.id !== id);
          deleteArmedId = null;
          toast('Notification deleted.', 'success');
          render();
        } catch (err) {
          toast(err.message || 'Could not delete the notification.', 'error');
          render();
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
   * New notification modal
   * ------------------------------------------------------------------- */
  function openModal() {
    $('#notifTitle').value = '';
    $('#notifDesc').value = '';
    $('#notifType').value = 'updated';
    $('#notifImage').value = '';
    $('#notifFormError').classList.add('hidden');
    $('#notifFormError').textContent = '';
    $('#notifModalBackdrop').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#notifTitle').focus(), 60);
  }

  function closeModal() {
    $('#notifModalBackdrop').classList.add('hidden');
    document.body.style.overflow = '';
  }

  async function submitForm(event) {
    event.preventDefault();
    const title = $('#notifTitle').value.trim();
    const error = $('#notifFormError');
    const sendBtn = $('#notifSend');

    if (!title) {
      error.textContent = 'A title is required.';
      error.classList.remove('hidden');
      $('#notifTitle').focus();
      return;
    }

    const payload = {
      title,
      description: $('#notifDesc').value.trim(),
      type: $('#notifType').value,
      image_url: $('#notifImage').value.trim(),
    };

    sendBtn.disabled = true;
    try {
      const row = await Api.sendNotification(payload);
      all.unshift(row);
      closeModal();
      deleteArmedId = null;
      render();
      toast(`Notification "${row.title}" saved for the app audience.`, 'success');
    } catch (err) {
      error.textContent = err.message || 'Could not send the notification.';
      error.classList.remove('hidden');
    } finally {
      sendBtn.disabled = false;
    }
  }

  async function init() {
    try {
      all = (await Api.notifications()) || [];
      render();
    } catch (err) {
      $('#resultsInfo').textContent = err.message || 'Could not load notifications.';
    }

    const searchBox = $('#notifSearch');
    searchBox?.addEventListener(
      'input',
      Utils.debounce(() => {
        search = searchBox.value;
        render();
      }, 250)
    );

    $('#newNotifBtn')?.addEventListener('click', openModal);
    $('#notifForm')?.addEventListener('submit', submitForm);
    $('#notifModalClose')?.addEventListener('click', closeModal);
    $('#notifModalCancel')?.addEventListener('click', closeModal);
    $('#notifModalBackdrop')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#notifModalBackdrop').classList.contains('hidden')) closeModal();
    });
  }

  return { init };
})();

window.Notifications = Notifications;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', Notifications.init)
  : Notifications.init();
