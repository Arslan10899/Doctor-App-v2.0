/* ==========================================================================
   Doctor Application – My Ads page
   The admin's own advertisement content: create / edit / delete ads with a
   banner image, date range and active switch. The backup's promo banners and
   commercial texts are listed below as a read-only reference.
   ========================================================================== */

const MyAds = (() => {
  let ads = [];
  let backups = [];
  let editingId = null;      /* null = create */
  let pendingFile = null;    /* File selected in the modal */
  let existingImageUrl = null;
  let imageRemoved = false;  /* user cleared the previously saved image */
  let imageTouched = false;  /* file chosen, link typed or image removed */

  const $ = (s) => document.querySelector(s);

  function icon(name) {
    return window.Icon ? window.Icon(name) : '';
  }

  /* ------------------------------------------------------------------- UI */

  function chip(value, label) {
    return `
      <div class="ma-chip">
        <div class="ma-chip-value">${Utils.number(value)}</div>
        <div class="ma-chip-label">${Utils.escape(label)}</div>
      </div>
    `;
  }

  function renderSummary() {
    const active = ads.filter((a) => a.active).length;
    const paused = ads.length - active;
    $('#maSummary').innerHTML =
      chip(ads.length, 'My ads') +
      chip(active, 'Active') +
      chip(paused, 'Paused') +
      chip(backups.length, 'From the backup');
    $('#myAdsCount').textContent = ads.length ? `${ads.length} ad${ads.length === 1 ? '' : 's'}` : '';
    $('#backupCount').textContent = backups.length ? `${backups.length} promo${backups.length === 1 ? '' : 's'}` : '';
  }

  function dateBadge(from, to) {
    if (!from && !to) return '';
    const range = `${from || '…'} → ${to || '…'}`;
    return `<span class="ma-badge">${icon('calendar-check')} ${Utils.escape(range)}</span>`;
  }

  function adCard(ad) {
    const paused = !ad.active;
    return `
      <article class="ma-card ${paused ? 'is-paused' : ''}" data-id="${ad.id}">
        ${ad.image_url
          ? `<div class="ma-thumb"><img src="${Utils.escape(ad.image_url)}" alt=""
                 data-fallback="image"
                 onerror="this.onerror=null; this.closest('.ma-thumb').innerHTML = window.Icon ? window.Icon(this.dataset.fallback) : ''" /></div>`
          : `<div class="ma-thumb">${icon('image')}</div>`}
        <div class="ma-card-head">
          <div class="ma-title">${Utils.escape(ad.title)}</div>
          <span class="ma-badge ${ad.active ? 'is-active' : 'is-paused'}">
            ${icon(ad.active ? 'check' : 'pause')} ${ad.active ? 'Active' : 'Paused'}
          </span>
        </div>
        ${ad.content ? `<div class="ma-content">${Utils.escape(ad.content)}</div>` : ''}
        <div class="ma-badges">${dateBadge(ad.date_from, ad.date_to)}</div>
        <div class="ma-actions">
          <button type="button" class="btn btn-outline btn-sm" data-act="edit">
            ${icon('pencil')} Edit
          </button>
          <span class="spacer"></span>
          <button type="button" class="ma-ghost" data-act="toggle" title="${ad.active ? 'Pause this ad' : 'Resume this ad'}">
            ${icon(ad.active ? 'pause' : 'play')} ${ad.active ? 'Pause' : 'Resume'}
          </button>
          <button type="button" class="ma-ghost is-danger" data-act="delete" title="Delete this ad">
            ${icon('trash-2')} Delete
          </button>
        </div>
      </article>
    `;
  }

  function shortDate(value) {
    if (!value) return '';
    return String(value).split(' ')[0];
  }

  function backupCard(p) {
    const isBanner = p.kind === 'banner';
    const kindLabel = isBanner ? 'Banner' : 'Text';
    const kindIcon = isBanner ? 'image' : 'megaphone';
    const from = shortDate(p.date_from);
    const to = shortDate(p.date_to);

    const thumb = p.image_url
      ? `<img src="${Utils.escape(p.image_url)}" alt="" data-fallback="${kindIcon}"
             onerror="this.onerror=null; var d=document.createElement('div'); d.className='bk-empty'; d.innerHTML = (window.Icon ? window.Icon(this.dataset.fallback) : '') + '<span>Image unavailable</span>'; this.replaceWith(d);" />`
      : `<div class="bk-empty">${icon(kindIcon)}</div>`;

    const dates =
      from || to
        ? `<div class="bk-dates">
             <span class="bk-date">${icon('calendar-check')} ${Utils.escape(from || '…')}</span>
             <span class="bk-arrow">→</span>
             <span class="bk-date">${icon('calendar-check')} ${Utils.escape(to || '…')}</span>
           </div>`
        : '';

    /* banner images come from Firebase Storage; texts were posted by the app admin */
    const owner = !isBanner && p.admin_name ? p.admin_name : '';

    return `
      <article class="bk-card" style="cursor:default;">
        <div class="bk-thumb">
          <span class="bk-kind ${isBanner ? '' : 'is-text'}">${icon(kindIcon)} ${kindLabel}</span>
          ${thumb}
        </div>
        <div class="bk-body">
          <div class="bk-title">${Utils.escape(p.title || (isBanner ? 'Promo banner' : 'Promo text'))}</div>
          ${p.content ? `<div class="bk-content">${Utils.escape(p.content)}</div>` : ''}
          ${dates}
          <div class="bk-foot">
            <span class="bk-source">${icon('database')} Backup · ${isBanner ? 'App carousel' : 'App promo'}</span>
            ${owner ? `<span class="bk-owner" title="${Utils.escape(owner)}">${Utils.escape(owner)}</span>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  function renderAds() {
    const grid = $('#myAdsGrid');
    grid.innerHTML = ads.map(adCard).join('');
    $('#myAdsEmpty').classList.toggle('hidden', ads.length > 0);
    bindActions(grid);
  }

  function renderBackups() {
    const grid = $('#backupGrid');
    grid.innerHTML = backups.map(backupCard).join('');
    $('#backupEmpty').classList.toggle('hidden', backups.length > 0);
  }

  /* ------------------------------------------------------- card actions */

  function bindActions(grid) {
    grid.querySelectorAll('.ma-card [data-act]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const card = btn.closest('.ma-card');
        const id = Number(card.dataset.id);
        const ad = ads.find((a) => a.id === id);
        if (!ad) return;

        const act = btn.dataset.act;

        if (act === 'edit') {
          openModal(ad);
          return;
        }

        if (act === 'toggle') {
          btn.disabled = true;
          try {
            const updated = await Api.patch(`/my-ads/${id}/toggle`);
            const idx = ads.findIndex((a) => a.id === id);
            if (idx >= 0) ads[idx] = updated;
            renderSummary();
            renderAds();
          } catch (err) {
            window.alert(err.message || 'Could not update the ad.');
          }
          return;
        }

        if (act === 'delete') {
          /* two-step inline confirm */
          if (!btn.classList.contains('is-confirm')) {
            btn.classList.add('is-confirm');
            btn.innerHTML = `${icon('trash-2')} Sure?`;
            setTimeout(() => {
              if (btn.isConnected) {
                btn.classList.remove('is-confirm');
                btn.innerHTML = `${icon('trash-2')} Delete`;
              }
            }, 3500);
            return;
          }
          btn.disabled = true;
          try {
            await Api.delete(`/my-ads/${id}`);
            ads = ads.filter((a) => a.id !== id);
            renderSummary();
            renderAds();
          } catch (err) {
            window.alert(err.message || 'Could not delete the ad.');
          }
        }
      });
    });
  }

  /* -------------------------------------------------------------- modal */

  function openModal(ad = null) {
    editingId = ad ? ad.id : null;
    pendingFile = null;
    imageRemoved = false;
    imageTouched = false;
    existingImageUrl = ad ? ad.image_url : null;

    $('#adModalTitle').textContent = ad ? 'Edit My Ad' : 'Add My Ad';
    $('#adId').value = ad ? String(ad.id) : '';
    $('#adTitle').value = ad ? ad.title || '' : '';
    $('#adContent').value = ad ? ad.content || '' : '';
    $('#adDateFrom').value = ad ? ad.date_from || '' : '';
    $('#adDateTo').value = ad ? ad.date_to || '' : '';
    $('#adActive').checked = ad ? !!ad.active : true;
    $('#adFormError').classList.add('hidden');
    $('#adFormError').textContent = '';
    $('#adImageFile').value = '';
    $('#adImageUrl').value = '';

    refreshPreview();
    $('#adModalBackdrop').classList.remove('hidden');
    setTimeout(() => $('#adTitle').focus(), 60);
  }

  function closeModal() {
    $('#adModalBackdrop').classList.add('hidden');
    if (pendingFile) URL.revokeObjectURL(pendingFile.__url);
    pendingFile = null;
    editingId = null;
    existingImageUrl = null;
    imageRemoved = false;
    imageTouched = false;
  }

  /* A pasted YouTube link becomes its poster thumbnail (same rule the
     server applies when saving). */
  function youtubeThumb(raw) {
    const url = String(raw || '').trim();
    const id = url.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{6,})/);
    return url && /youtu/i.test(url) && id ? `https://i.ytimg.com/vi/${id[1]}/hqdefault.jpg` : null;
  }

  function currentDraftUrl() {
    const raw = $('#adImageUrl').value.trim();
    if (!raw) return '';
    return youtubeThumb(raw) || raw;
  }

  function refreshPreview() {
    const wrap = $('#adImagePreviewWrap');
    const note = $('#adImageExistingNote');
    const broken = $('#adImageBrokenNote');
    const img = $('#adImagePreview');
    broken.classList.add('hidden');
    img.style.opacity = '';

    const draft = currentDraftUrl();
    if (pendingFile) {
      img.src = pendingFile.__url;
      wrap.classList.remove('hidden');
      note.classList.add('hidden');
    } else if (draft) {
      img.src = draft;
      wrap.classList.remove('hidden');
      note.classList.add('hidden');
    } else if (existingImageUrl && !imageRemoved) {
      img.src = existingImageUrl;
      wrap.classList.remove('hidden');
      note.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
      img.removeAttribute('src');
      note.classList.add('hidden');
    }
  }

  function pickFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showError('Image is larger than 5 MB – choose a smaller file.');
      return;
    }
    if (pendingFile) URL.revokeObjectURL(pendingFile.__url);
    file.__url = URL.createObjectURL(file);
    pendingFile = file;
    imageRemoved = false;
    imageTouched = true;
    /* a chosen file wins – drop the pasted link */
    $('#adImageUrl').value = '';
    refreshPreview();
  }

  function showError(message) {
    const box = $('#adFormError');
    box.textContent = message;
    box.classList.remove('hidden');
  }

  async function submitForm(event) {
    event.preventDefault();
    const title = $('#adTitle').value.trim();
    if (!title) {
      showError('Please enter a title for the ad.');
      $('#adTitle').focus();
      return;
    }

    const payload = {
      title,
      content: $('#adContent').value.trim(),
      date_from: $('#adDateFrom').value,
      date_to: $('#adDateTo').value,
      active: $('#adActive').checked,
    };

    /*
     * Banner resolution order:
     *   1. a newly chosen file      -> upload after saving
     *   2. a pasted / edited link   -> send as image_url ('' clears it)
     *   3. image removed via the ✕  -> clear as well
     *   4. nothing touched          -> the saved image stays untouched
     */
    if (!pendingFile) {
      const url = currentDraftUrl();
      if (url || imageTouched) payload.image_url = url;
    }

    const saveBtn = $('#adModalSave');
    saveBtn.disabled = true;

    try {
      let saved;
      if (editingId) {
        saved = await Api.put(`/my-ads/${editingId}`, payload);
      } else {
        saved = await Api.post('/my-ads', payload);
      }

      /* Upload the banner only after the ad itself exists. */
      if (pendingFile) {
        const form = new FormData();
        form.append('file', pendingFile);
        saved = await Api.upload(`/my-ads/${saved.id}/image`, form);
      }

      if (editingId) {
        const idx = ads.findIndex((a) => a.id === saved.id);
        if (idx >= 0) ads[idx] = saved;
      } else {
        ads.unshift(saved);
      }

      closeModal();
      renderSummary();
      renderAds();
    } catch (err) {
      showError(err.message || 'Could not save the ad.');
    } finally {
      saveBtn.disabled = false;
    }
  }

  /* ---------------------------------------------------------------- init */

  function bind() {
    $('#addAdBtn').addEventListener('click', () => openModal());
    $('#adModalClose').addEventListener('click', closeModal);
    $('#adModalCancel').addEventListener('click', closeModal);
    $('#adModalBackdrop').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#adModalBackdrop').classList.contains('hidden')) closeModal();
    });

    $('#adForm').addEventListener('submit', submitForm);

    $('#adImagePick').addEventListener('click', () => $('#adImageFile').click());
    $('#adImageFile').addEventListener('change', (event) => pickFile(event.target.files[0]));
    $('#adImageUrl').addEventListener('input', () => {
      imageTouched = true;
      imageRemoved = true; /* a pasted link replaces the saved image */
      refreshPreview();
    });
    $('#adImageUrl').addEventListener('change', () => refreshPreview());
    $('#adImageRemove').addEventListener('click', () => {
      if (pendingFile) {
        URL.revokeObjectURL(pendingFile.__url);
        pendingFile = null;
      }
      $('#adImageUrl').value = '';
      imageTouched = true;
      imageRemoved = true;
      $('#adImageFile').value = '';
      refreshPreview();
    });
  }

  async function init() {
    bind();
    try {
      const [myAds, backupPromos] = await Promise.all([Api.myAds(), Api.backupPromos()]);
      ads = Array.isArray(myAds) ? myAds : [];
      backups = Array.isArray(backupPromos) ? backupPromos : [];
    } catch (err) {
      const empty = $('#myAdsEmpty');
      empty.classList.remove('hidden');
      empty.innerHTML = `<span class="text-sm" style="color:var(--destructive);">${Utils.escape(err.message || 'Could not load the ads.')}</span>`;
      return;
    }
    renderSummary();
    renderAds();
    renderBackups();
  }

  return { init };
})();

window.MyAds = MyAds;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', MyAds.init)
  : MyAds.init();
