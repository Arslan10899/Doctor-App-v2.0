/* ==========================================================================
   Doctor Application – Doctor full profile page
   Shows every field stored in the local database.
   ========================================================================== */

(function () {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('id'));

  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const $ = (sel) => document.querySelector(sel);

  /* ---------------------------------------------------------------------
   * Small render helpers
   * ------------------------------------------------------------------- */
  function detail(iconName, label, value, opts) {
    const o = opts || {};
    const val =
      value === null || value === undefined || String(value).trim() === '' ? '—' : value;
    const isLink = o.href && val !== '—';
    const inner = isLink
      ? `<a href="${Utils.escape(o.href)}" class="text-sm" style="font-weight:500;word-break:break-all;color:var(--primary);">${Utils.escape(
          String(val)
        )}</a>`
      : `<div class="text-sm" style="font-weight:500;word-break:break-word;margin-top:.125rem;">${Utils.escape(
          String(val)
        )}</div>`;
    return `<div style="display:flex;gap:.625rem;align-items:flex-start;padding:.75rem;border:1px solid var(--border);border-radius:var(--radius-md);">
      <span style="color:var(--muted-foreground);margin-top:.125rem;flex-shrink:0;">${window.Icon(iconName)}</span>
      <div style="min-width:0;flex:1;">
        <div class="text-xs text-muted">${Utils.escape(label)}</div>
        ${inner}
      </div>
    </div>`;
  }

  function stat(iconName, label, value) {
    return `<div style="display:flex;align-items:center;gap:.625rem;padding:.875rem;border:1px solid var(--border);border-radius:var(--radius-lg);">
      <div style="display:grid;place-items:center;width:2rem;height:2rem;border-radius:9999px;background:color-mix(in oklab,var(--muted) 70%,transparent);color:var(--muted-foreground);flex-shrink:0;">
        ${window.Icon(iconName)}
      </div>
      <div style="min-width:0;">
        <div class="text-xs text-muted">${Utils.escape(label)}</div>
        <div class="stat-value" style="font-size:1.125rem;">${value}</div>
      </div>
    </div>`;
  }

  function parseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }

  function textValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function daySort(a, b) {
    const ai = DAY_ORDER.findIndex((d) => String(a).toLowerCase().startsWith(d.toLowerCase()));
    const bi = DAY_ORDER.findIndex((d) => String(b).toLowerCase().startsWith(d.toLowerCase()));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  }

  function dayLabel(day) {
    // "Monday - پیر " -> "Monday"
    return String(day).split('-')[0].trim();
  }

  function sortDays(list) {
    return Array.from(list || []).sort(daySort);
  }

  /* ---------------------------------------------------------------------
   * Timings
   * ------------------------------------------------------------------- */
  function renderTimings(timings) {
    if (!timings || typeof timings !== 'object' || Array.isArray(timings)) return '';
    const days = Object.keys(timings).sort(daySort);

    return days
      .map((day) => {
        const entry = timings[day] || {};
        const closed = entry.isClosed === true || entry.isClosed === 'true';
        const label = dayLabel(day);
        const urdu = String(day).includes('-') ? String(day).split('-').slice(1).join('-').trim() : '';
        const value = closed
          ? '<span class="text-muted">Closed</span>'
          : entry.open && entry.close
          ? `${Utils.escape(entry.open)} – ${Utils.escape(entry.close)}`
          : '<span class="text-muted">—</span>';
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.375rem 0;border-bottom:1px dashed var(--border);">
          <span class="text-sm" style="font-weight:500;">${Utils.escape(label)}${
          urdu ? ` <span class="text-xs text-muted">${Utils.escape(urdu)}</span>` : ''
        }</span>
          <span class="text-sm">${value}</span>
        </div>`;
      })
      .join('');
  }

  /* ---------------------------------------------------------------------
   * OT schedule (backup shape: hospitalCity, hospitalName, days[], yesNo, time, specialty)
   * ------------------------------------------------------------------- */
  function renderOtSchedule(list) {
    if (!Array.isArray(list) || !list.length) return '';

    return `<div class="table-wrap"><table class="table"><thead><tr>
      <th>Days</th><th>Hospital</th><th>City</th><th>Specialty</th><th>Time</th>
    </tr></thead><tbody>${list
      .map((row) => {
        const days = sortDays(row.days || []).map(dayLabel).join(', ') || '—';
        return `<tr>
          <td class="cell-strong">${Utils.escape(days)}</td>
          <td>${Utils.escape(row.hospitalName || row.clinicName || '—')}</td>
          <td>${Utils.escape(row.hospitalCity || '—')}</td>
          <td>${Utils.escape(row.specialty || row.opdSpecialty || '—')}</td>
          <td>${Utils.escape(row.time || (row.startTime ? `${row.startTime} – ${row.endTime || ''}` : '—'))}</td>
        </tr>`;
      })
      .join('')}</tbody></table></div>`;
  }

  /* ---------------------------------------------------------------------
   * OPD (backup shape: one object or the literal "No")
   * ------------------------------------------------------------------- */
  function renderOpd(value) {
    const opd = parseJson(value);

    if (opd && typeof opd === 'object' && !Array.isArray(opd)) {
      const days = sortDays(opd.days || []).map(dayLabel).join(', ');
      return `
        <div style="display:flex;flex-direction:column;gap:.5rem;">
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted">Hospital</span>
            <span class="text-sm" style="font-weight:500;text-align:right;">${Utils.escape(
              opd.hospitalName || '—'
            )}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted">Specialty</span>
            <span class="text-sm" style="font-weight:500;text-align:right;">${Utils.escape(
              opd.specialty || '—'
            )}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted">Days</span>
            <span class="text-sm" style="font-weight:500;text-align:right;">${Utils.escape(days || '—')}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted">Time</span>
            <span class="text-sm" style="font-weight:500;text-align:right;">${Utils.escape(
              opd.time || '—'
            )}</span>
          </div>
        </div>`;
    }

    // A JSON-encoded plain string (the backup uses `"No"`) is not a schedule.
    let text = '';
    if (typeof opd === 'string') text = opd.trim();
    else if (opd === null) text = textValue(value).trim();
    else text = textValue(opd).trim();

    if (!text || /^no$/i.test(text)) return '';
    return `<p class="text-sm" style="line-height:1.7;white-space:pre-wrap;">${Utils.escape(text)}</p>`;
  }

  /** True only when `opd_info` describes a real schedule. */
  function hasOpd(value) {
    const parsed = parseJson(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed).length > 0;
    }
    if (typeof parsed === 'string') {
      const text = parsed.trim();
      return !!text && !/^no$/i.test(text);
    }
    if (parsed === null && value) {
      const text = textValue(value).trim();
      return !!text && !/^no$/i.test(text) && text !== 'null';
    }
    return false;
  }

  /* ---------------------------------------------------------------------
   * Clinics (each clinic carries its own weekly timings)
   * ------------------------------------------------------------------- */
  function renderClinics(list, fallbackTimings) {
    if (!Array.isArray(list) || !list.length) return '';

    return list
      .map((clinic) => {
        const name = clinic.clinicName || clinic.hospitalName || clinic.name || 'Clinic';
        const address = clinic.address || '';
        const timings = clinic.timings && typeof clinic.timings === 'object' ? clinic.timings : null;
        const timingsHtml = renderTimings(timings) || (list.length === 1 ? renderTimings(fallbackTimings) : '');

        return `<div style="padding:.875rem;border:1px solid var(--border);border-radius:var(--radius-md);">
          <div style="display:flex;gap:.5rem;align-items:flex-start;">
            <span style="color:var(--muted-foreground);margin-top:.125rem;">${window.Icon('building-2')}</span>
            <div style="min-width:0;flex:1;">
              <div class="text-sm" style="font-weight:600;line-height:1.5;">${Utils.escape(name)}</div>
              ${
                address
                  ? `<div class="text-xs text-muted" style="margin-top:.25rem;line-height:1.6;">${Utils.escape(
                      address
                    )}</div>`
                  : ''
              }
              ${
                timingsHtml
                  ? `<details style="margin-top:.625rem;">
                      <summary class="text-xs" style="cursor:pointer;color:var(--primary);font-weight:500;">Weekly timings</summary>
                      <div style="margin-top:.375rem;">${timingsHtml}</div>
                    </details>`
                  : ''
              }
            </div>
          </div>
        </div>`;
      })
      .join('');
  }

  /* ---------------------------------------------------------------------
   * Load + paint
   * ------------------------------------------------------------------- */
  async function load() {
    const profileContent = $('#profileContent');
    const profileError = $('#profileError');
    const profileErrorMsg = $('#profileErrorMsg');
    const profileName = $('#profileName');
    const profileSub = $('#profileSub');

    if (!Number.isFinite(id) || id <= 0) {
      profileContent.style.display = 'none';
      profileError.style.display = 'flex';
      profileErrorMsg.textContent = 'Invalid doctor ID.';
      profileName.textContent = 'Doctor not found';
      profileSub.textContent = 'The link is missing or incorrect.';
      return;
    }

    profileError.style.display = 'none';
    profileContent.style.display = 'flex';
    profileName.textContent = 'Loading…';
    profileSub.textContent = 'Fetching full profile details.';

    try {
      const doctor = await Api.getDoctor(id);
      const d = doctor || {};

      const name = d.name || 'Unknown Doctor';
      const specialty = d.specialty || '—';
      const qualification = d.qualification || '—';
      const hospital = d.hospital || '—';
      const city = d.city || '—';
      const country = d.country || 'Pakistan';

      document.title = `${name} · Doctor Profile · Doctor Application`;

      profileName.textContent = name;
      profileSub.textContent = `${specialty} • ${qualification}`;

      $('#profileCardName').textContent = name;
      $('#profileCardMeta').textContent = [specialty, qualification].filter(Boolean).join(' · ');
      $('#profileAvatar').innerHTML = Utils.avatar(d, 'avatar-xl');
      $('#profileStatus').innerHTML = Utils.statusBadge(d.status || 'Active');
      $('#profileFee').textContent = Utils.money(d.consultation_fee || 0);

      const sehatBadge = $('#sehatBadge');
      if (sehatBadge) {
        sehatBadge.style.display = Number(d.sehat_card_empaneled) ? 'inline-flex' : 'none';
      }

      $('#profileQuickStats').innerHTML = [
        stat('circle-dollar-sign', 'Consultation Fee', Utils.money(d.consultation_fee || 0)),
        stat('star', 'Rating', Number(d.rating || 0).toFixed(1)),
        stat('users', 'Appointments', Utils.number(d.appointments_count || 0)),
        stat('clock', 'Experience', `${d.experience_years || 0} yr`),
      ].join('');

      $('#profileDetailsGrid').innerHTML = [
        detail('mail', 'Email', d.email),
        detail('phone', 'Phone', d.phone),
        detail('message-square', 'WhatsApp', d.whatsapp),
        detail('user-round', 'Gender', d.gender),
        detail('file-text', 'Qualification', d.qualification),
        detail('sparkles', 'Specialty', d.specialty),
        detail('activity', 'Experience', `${d.experience_years || 0} years`),
        detail('circle-dollar-sign', 'Consultation Fee', Utils.money(d.consultation_fee || 0)),
        detail('star', 'Rating', Number(d.rating || 0).toFixed(1)),
        detail('users', 'Appointments', Utils.number(d.appointments_count || 0)),
        detail('building-2', 'Hospital', d.hospital),
        detail('map-pin', 'City', d.city),
        detail('type', 'Urdu Name', d.urdu_name),
        detail(
          'shield-check',
          'Sehat Card',
          Number(d.sehat_card_empaneled) ? 'Empaneled' : 'Not empaneled'
        ),
      ].join('');

      /* Bio / message */
      const bioText = d.doctors_message || d.bio || '';
      const bioCard = $('#bioCard');
      if (bioText) {
        bioCard.style.display = 'block';
        $('#profileBio').textContent = bioText;
      } else {
        bioCard.style.display = 'none';
      }

      /* Diseases */
      const diseases = textValue(d.diseases).trim();
      const diseasesCard = $('#diseasesCard');
      if (diseases) {
        diseasesCard.style.display = 'block';
        $('#profileDiseases').textContent = diseases;
      } else {
        diseasesCard.style.display = 'none';
      }

      /* OT schedule */
      const ot = parseJson(d.ot_schedule);
      const otCard = $('#otCard');
      if (Array.isArray(ot) && ot.length) {
        otCard.style.display = 'block';
        $('#profileOt').innerHTML = renderOtSchedule(ot);
      } else {
        otCard.style.display = 'none';
      }

      /* OPD */
      const opdHtml = renderOpd(d.opd_info);
      const opdCard = $('#opdCard');
      if (opdCard) {
        if (opdHtml) {
          opdCard.style.display = 'block';
          $('#profileOpd').innerHTML = opdHtml;
        } else {
          opdCard.style.display = 'none';
        }
      }

      /* Clinics */
      const clinics = parseJson(d.clinics_json);
      const timings = parseJson(d.timings_json);
      $('#profileClinic').innerHTML =
        renderClinics(clinics, timings) ||
        `<div style="display:flex;gap:.625rem;align-items:flex-start;">
          <span style="color:var(--muted-foreground);margin-top:.125rem;">${window.Icon('building-2')}</span>
          <div>
            <div class="text-xs text-muted">Hospital / Clinic</div>
            <div class="text-sm" style="font-weight:500;margin-top:.125rem;">${Utils.escape(hospital)}</div>
          </div>
        </div>`;

      $('#profileLocation').innerHTML = `
        <div style="display:flex;gap:.625rem;align-items:flex-start;">
          <span style="color:var(--muted-foreground);margin-top:.125rem;">${window.Icon('map-pin')}</span>
          <div>
            <div class="text-xs text-muted">Location</div>
            <div class="text-sm" style="font-weight:500;margin-top:.125rem;">${Utils.escape(city)}, ${Utils.escape(
        country
      )}</div>
          </div>
        </div>`;

      /* Clinic timings card (only when the first clinic has no inline timings) */
      const timingsCard = $('#timingsCard');
      const firstHasTimings =
        Array.isArray(clinics) &&
        clinics.some((c) => c && c.timings && Object.keys(c.timings || {}).length);
      const timingsHtml = firstHasTimings ? '' : renderTimings(timings);
      if (timingsHtml) {
        timingsCard.style.display = 'block';
        $('#profileTimings').innerHTML = timingsHtml;
      } else {
        timingsCard.style.display = 'none';
      }

      /* Contact */
      const contact = [];
      if (d.phone) contact.push(detail('phone', 'Phone', d.phone, { href: `tel:${d.phone}` }));
      if (d.whatsapp) {
        const wa = String(d.whatsapp).replace(/[^\d+]/g, '').replace('+', '');
        contact.push(detail('message-square', 'WhatsApp', d.whatsapp, { href: `https://wa.me/${wa}` }));
      }
      if (d.email) contact.push(detail('mail', 'Email', d.email, { href: `mailto:${d.email}` }));
      $('#profileContact').innerHTML =
        contact.join('') || '<div class="text-sm text-muted">No contact details available.</div>';

      /* Meta */
      $('#profileId').textContent = `#${d.id}`;
      $('#profileViews').textContent = Utils.number(d.views_count || 0);
      $('#profileCalls').textContent = Utils.number(d.total_calls || 0);
      $('#profileOpdFlag').textContent = hasOpd(d.opd_info) ? 'Available' : '—';
      $('#profileCreated').textContent = d.created_at ? Utils.formatDate(d.created_at) : '—';
      $('#profileUpdated').textContent = d.updated_at ? Utils.formatDateTime(d.updated_at) : '—';

      /* Media gallery (photos + videos) */
      renderDoctorMedia(d.media);

      /* Edit link */
      const editLink = $('#editProfile');
      if (editLink) editLink.setAttribute('href', `doctor-edit.html?v=50&id=${encodeURIComponent(d.id)}`);
    } catch (err) {
      profileContent.style.display = 'none';
      profileError.style.display = 'flex';
      profileErrorMsg.textContent = err.message || 'Something went wrong.';
      profileName.textContent = 'Doctor not found';
      profileSub.textContent = 'Could not load this doctor profile.';
    }
  }

  const refreshBtn = document.getElementById('refreshProfile');
  if (refreshBtn) refreshBtn.addEventListener('click', load);

  /* ---------------------------------------------------------------------
   * Media gallery (photos + videos)
   * ------------------------------------------------------------------- */
  function youTubeEmbed(url) {
    const m = String(url).match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/i
    );
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }

  function isDirectVideoUrl(url) {
    return /\.(mp4|webm|m4v|mov|ogg)(\?|#|$)/i.test(String(url));
  }

  function openVideoPlayer({ url, kind, provider }) {
    const backdrop = document.getElementById('videoModalBackdrop');
    const body = document.getElementById('videoModalBody');
    const title = document.getElementById('videoModalTitle');
    if (!backdrop || !body) return;
    let html = '';
    if (provider === 'link') {
      const yt = youTubeEmbed(url);
      if (yt) {
        html = `<iframe src="${Utils.escape(yt)}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen style="width:100%;height:100%;border:0;"></iframe>`;
      } else if (isDirectVideoUrl(url)) {
        html = `<video controls autoplay src="${Utils.escape(url)}" style="width:100%;height:100%;"></video>`;
      } else {
        html = `<div style="color:#fff;padding:2rem;text-align:center;">Is link ko direct play nahi kar sakte.<br><a href="${Utils.escape(url)}" target="_blank" rel="noopener" style="color:#93c5fd;">Browser mein open karein ↗</a></div>`;
      }
    } else {
      html = `<video controls autoplay src="${Utils.escape(url)}" style="width:100%;height:100%;"></video>`;
    }
    body.innerHTML = html;
    if (title) title.textContent = kind === 'youtube' ? 'YouTube video' : 'Video';
    backdrop.classList.remove('hidden');
  }

  function closeVideoPlayer() {
    const backdrop = document.getElementById('videoModalBackdrop');
    const body = document.getElementById('videoModalBody');
    if (body) body.innerHTML = '';
    if (backdrop) backdrop.classList.add('hidden');
  }

  function renderDoctorMedia(media) {
    const list = Array.isArray(media) ? media : [];
    const images = list.filter((m) => m.kind === 'image');
    const videos = list.filter((m) => m.kind === 'video');

    const imgGrid = $('#mediaImages');
    const imgEmpty = $('#mediaImagesEmpty');
    if (imgGrid) {
      imgGrid.innerHTML = images
        .map(
          (m) => `
          <div class="media-tile">
            <img src="${Utils.escape(m.url)}" alt="Photo" loading="lazy" />
            <button type="button" class="media-delete" data-id="${Number(m.id)}" title="Delete photo">&#10005;</button>
          </div>`
        )
        .join('');
      if (imgEmpty) imgEmpty.style.display = images.length ? 'none' : 'flex';
    }

    const vidBox = $('#mediaVideos');
    const vidEmpty = $('#mediaVideosEmpty');
    if (vidBox) {
      vidBox.innerHTML = videos
        .map((m) => {
          let thumb = '';
          let kind = 'video';
          if (m.provider === 'link') {
            const yt = youTubeEmbed(m.url);
            if (yt) {
              const idMatch = m.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/i);
              const yid = idMatch ? idMatch[1] : '';
              thumb = yid ? `https://img.youtube.com/vi/${yid}/hqdefault.jpg` : '';
              kind = 'youtube';
            } else if (isDirectVideoUrl(m.url)) {
              kind = 'direct';
            } else {
              kind = 'link';
            }
          } else {
            kind = 'direct';
          }
          const thumbHtml = thumb
            ? `<img src="${Utils.escape(thumb)}" alt="Video thumbnail" loading="lazy" />`
            : `<video preload="metadata" muted src="${Utils.escape(m.url)}" style="width:100%;height:100%;object-fit:cover;"></video>`;
          return `
          <div class="media-tile media-video-tile" data-video-id="${Number(m.id)}" data-video-url="${Utils.escape(m.url)}" data-video-kind="${kind}" data-video-provider="${Utils.escape(m.provider || '')}" title="Play video">
            ${thumbHtml}
            <span class="media-play-badge">${window.Icon('play')}</span>
            <button type="button" class="media-delete" data-id="${Number(m.id)}" title="Delete video">&#10005;</button>
          </div>`;
        })
        .join('');
      if (vidEmpty) vidEmpty.style.display = videos.length ? 'none' : 'flex';
    }
  }

  function setMediaBusy(busy) {
    ['btnAddImages', 'btnAddVideoFile', 'btnAddVideoLink', 'btnSaveVideoLink'].forEach((sel) => {
      const btn = $(sel);
      if (btn) btn.disabled = busy;
    });
  }

  async function refreshMedia(doctorId) {
    const res = await Api.doctorMedia(doctorId);
    renderDoctorMedia(res.items || []);
  }

  function setupMedia(doctorId) {
    const inputImages = $('#mediaImageInput');
    const inputVideo = $('#mediaVideoInput');
    const btnLink = $('#btnAddVideoLink');
    const linkWrap = $('#mediaLinkWrap');
    if (!inputImages || !inputVideo || !btnLink) return;

    $('#btnAddImages').addEventListener('click', () => inputImages.click());
    $('#btnAddVideoFile').addEventListener('click', () => inputVideo.click());

    inputImages.addEventListener('change', async () => {
      const files = Array.from(inputImages.files || []);
      if (!files.length) return;
      const big = files.filter((f) => f.size > 10 * 1024 * 1024);
      if (big.length) {
        toast(`Image ${big.map((f) => f.name).join(', ')} 10 MB se bari hai`, 'error');
        inputImages.value = '';
        return;
      }
      setMediaBusy(true);
      try {
        const res = await Api.uploadDoctorImages(doctorId, files);
        renderDoctorMedia(res.items || []);
        toast(`${res.saved || files.length} photo(s) add ho gayi`);
      } catch (err) {
        toast(err.message || 'Upload fail hua', 'error');
      } finally {
        setMediaBusy(false);
        inputImages.value = '';
      }
    });

    inputVideo.addEventListener('change', async () => {
      const file = inputVideo.files && inputVideo.files[0];
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) {
        toast('Video 50 MB se bari hai – chhoti video ya link use karein', 'error');
        inputVideo.value = '';
        return;
      }
      setMediaBusy(true);
      toast('Video upload ho rahi hai… barri file lagi sakti hai', 'info');
      try {
        const res = await Api.uploadDoctorVideoFile(doctorId, file);
        renderDoctorMedia(res.items || []);
        toast('Video add ho gayi');
      } catch (err) {
        toast(err.message || 'Video upload fail hui', 'error');
      } finally {
        setMediaBusy(false);
        inputVideo.value = '';
      }
    });

    btnLink.addEventListener('click', () => {
      const show = linkWrap.style.display === 'none' || linkWrap.style.display === '';
      linkWrap.style.display = show ? 'flex' : 'none';
      if (show) $('#mediaVideoLinkInput').focus();
    });

    $('#btnSaveVideoLink').addEventListener('click', async () => {
      const url = $('#mediaVideoLinkInput').value.trim();
      if (!url) return;
      setMediaBusy(true);
      try {
        const res = await Api.addDoctorVideoLink(doctorId, url);
        renderDoctorMedia(res.items || []);
        $('#mediaVideoLinkInput').value = '';
        linkWrap.style.display = 'none';
        toast('Video link add ho gaya');
      } catch (err) {
        toast(err.message || 'Link save nahi hua', 'error');
      } finally {
        setMediaBusy(false);
      }
    });

    const handleDeleteClick = async (ev) => {
      const btn = ev.target.closest('.media-delete');
      if (!btn) return;
      if (!confirm('Ye media item delete karna hai?')) return;
      setMediaBusy(true);
      try {
        const res = await Api.deleteDoctorMedia(Number(btn.dataset.id));
        renderDoctorMedia(res.items || []);
        toast('Media delete ho gaya');
      } catch (err) {
        toast(err.message || 'Delete fail hua', 'error');
      } finally {
        setMediaBusy(false);
      }
    };
    const handleVideoClick = (ev) => {
      const delBtn = ev.target.closest('.media-delete');
      if (delBtn) {
        handleDeleteClick(ev);
        return;
      }
      const tile = ev.target.closest('.media-video-tile');
      if (!tile) return;
      openVideoPlayer({
        url: tile.dataset.videoUrl,
        kind: tile.dataset.videoKind,
        provider: tile.dataset.videoProvider,
      });
    };
    $('#mediaImages').addEventListener('click', handleDeleteClick);
    $('#mediaVideos').addEventListener('click', handleVideoClick);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (id) setupMedia(id);
    load();
    const closeBtn = document.getElementById('videoModalClose');
    const backdrop = document.getElementById('videoModalBackdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeVideoPlayer);
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeVideoPlayer(); });
  });
})();
