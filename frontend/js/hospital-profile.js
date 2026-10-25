/* ==========================================================================
   Doctor Application – Hospital profile page
   One hospital at a glance: header stats, every doctor whose clinic
   references the hospital, and all of its OPD/OT duty slots. Also the
   smooth landing target for the doctors / slots metrics on Hospitals.
   ========================================================================== */

const HospitalProfile = (() => {
  const $ = (s) => document.querySelector(s);

  function icon(name) {
    return window.Icon ? window.Icon(name) : '';
  }

  function statCard(label, value, iconName, valueStyle = '') {
    return `
      <div class="stat-card">
        <div class="stat-top">
          <div>
            <div class="stat-label">${Utils.escape(label)}</div>
            <div class="stat-value" style="${valueStyle}margin-top:.125rem;">${value}</div>
          </div>
          <div class="stat-icon">${icon(iconName)}</div>
        </div>
      </div>
    `;
  }

  function badge(text, opts = {}) {
    return `<span class="hp-badge ${opts.primary ? 'is-primary' : ''}">${opts.icon ? icon(opts.icon) : ''}${Utils.escape(text)}</span>`;
  }

  function doctorRow(d) {
    const status =
      d.status && d.status !== 'Active'
        ? `<span class="hp-badge">${Utils.escape(d.status)}</span>`
        : `<span class="hp-badge is-primary">${icon('user-round')} Active</span>`;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.75rem;min-width:0;">
            ${Utils.avatar(d)}
            <div style="min-width:0;">
              <a class="cell-strong link-cell" href="doctor-profile.html?v=32&id=${encodeURIComponent(d.id)}">${Utils.escape(d.name)}</a>
              <div class="cell-muted text-xs">${Utils.escape(d.email || '')}</div>
            </div>
          </div>
        </td>
        <td><div class="cell-strong">${Utils.escape(d.specialty || '—')}</div>${d.city ? `<div class="cell-muted text-xs">${Utils.escape(d.city)}</div>` : ''}</td>
        <td>${status}</td>
        <td>${d.rating ? `${Number(d.rating).toFixed(1)} / 5` : '—'}</td>
      </tr>
    `;
  }

  /* Short duty-slot doctor names ("Dr. Asif Aziz") must find the longer
     doctor records ("Dr Asif Aziz (Burn, ...)") – same trick as the
     appointments page. */
  function coreDoctorName(name) {
    return String(name || '')
      .replace(/^Dr\.?\s+/i, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
  }

  function slotRow(s) {
    const empty = !s.doctor_name || /no doctor/i.test(s.doctor_name);
    const doctorCell = empty
      ? `<span class="cell-muted">${Utils.escape(s.doctor_name || '—')}</span>`
      : `<a class="link-cell" href="doctors.html?v=32&search=${encodeURIComponent(coreDoctorName(s.doctor_name))}"
             title="Find this doctor on the Doctors page">${Utils.escape(s.doctor_name)}</a>`;

    return `
      <tr>
        <td>${doctorCell}</td>
        <td>${Utils.escape(s.opd_specialty || '—')}</td>
        <td><span class="hp-day">${Utils.escape(s.day || '—')}</span></td>
        <td>${Utils.escape(s.start_time || '')} – ${Utils.escape(s.end_time || '')}</td>
      </tr>
    `;
  }

  /* "Doctors at this hospital": show the top 3 by default, reveal the rest
     with a staggered fade-in when the user presses "Show all". */
  const DOCTORS_TOP_N = 3;
  let doctorsExpanded = false;
  let doctorsRowCache = [];

  function doctorRows(rows, offset = 0) {
    return rows
      .map((d, i) => {
        const html = doctorRow(d);
        /* stagger only the newly revealed extras */
        return offset
          ? html.replace('<tr>', `<tr style="animation-delay:${Math.min(i * 0.035, 0.5)}s;">`)
          : html;
      })
      .join('');
  }

  function updateDoctorsNote(total) {
    const note = $('#hpDoctorsNote');
    if (!note) return;
    note.textContent =
      total > 0
        ? doctorsExpanded
          ? `All ${total} doctor record${total === 1 ? '' : 's'} matched from the backup clinic addresses – scroll the list to browse.`
          : `Showing the top ${Math.min(DOCTORS_TOP_N, total)} of ${total} doctor record${total === 1 ? '' : 's'} from the backup – press "Show all" for the complete list.`
        : 'Doctors whose clinic address references this hospital.';
  }

  function renderDoctors(rows) {
    const body = $('#hpDoctorsBody');
    const extra = $('#hpDoctorsExtra');
    const foot = $('#hpDoctorsFoot');
    const wrap = $('#hpDoctorsWrap');
    if (!body) return;

    /* Expanded: every row inside a scrollable viewport (no page-length jump);
       collapsed: just the top 3. */
    body.innerHTML = doctorRows(
      doctorsExpanded ? rows : rows.slice(0, DOCTORS_TOP_N)
    );
    if (extra) {
      extra.innerHTML = '';
      extra.hidden = true;
    }
    if (wrap) {
      wrap.classList.toggle('is-expanded', doctorsExpanded);
      wrap.scrollTop = 0;
    }
    updateDoctorsNote(rows.length);

    if (!foot) return;
    foot.querySelectorAll('.hp-show-more').forEach((el) => el.remove());
    if (rows.length <= DOCTORS_TOP_N) {
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hp-show-more';
    if (doctorsExpanded) btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', String(doctorsExpanded));
    btn.innerHTML = doctorsExpanded
      ? `${icon('chevron-down')} Show top ${DOCTORS_TOP_N}`
      : `Show all <span class="hp-count">${Utils.number(rows.length)}</span> ${icon('chevron-down')}`;
    btn.addEventListener('click', () => {
      doctorsExpanded = !doctorsExpanded;
      renderDoctors(doctorsRowCache);
    });
    foot.appendChild(btn);
  }

  /* OPD/OT duty slots: top 3 by default, "Show all N" reveals the rest inside
     the same slim scrollable viewport as the doctors list. */
  const SLOTS_TOP_N = 3;
  let slotsExpanded = false;
  let slotsRowCache = [];

  function renderSlots(slots) {
    const body = $('#hpSlotsBody');
    const foot = $('#hpSlotsFoot');
    const wrap = $('#hpSlotsWrap');
    if (!body) return;

    body.innerHTML = (slotsExpanded ? slots : slots.slice(0, SLOTS_TOP_N))
      .map(slotRow)
      .join('');
    const empty = $('#hpSlotsEmpty');
    if (empty) empty.classList.toggle('hidden', slots.length > 0);

    if (wrap) {
      wrap.classList.toggle('is-expanded', slotsExpanded && slots.length > SLOTS_TOP_N);
      wrap.scrollTop = 0;
    }

    if (!foot) return;
    foot.querySelectorAll('.hp-show-more').forEach((el) => el.remove());
    if (slots.length <= SLOTS_TOP_N) {
      foot.hidden = true;
      slotsExpanded = false;
      return;
    }
    foot.hidden = false;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hp-show-more';
    if (slotsExpanded) btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', String(slotsExpanded));
    btn.innerHTML = slotsExpanded
      ? `${icon('chevron-down')} Show top ${SLOTS_TOP_N}`
      : `Show all <span class="hp-count">${Utils.number(slots.length)}</span> ${icon('chevron-down')}`;
    btn.addEventListener('click', () => {
      slotsExpanded = !slotsExpanded;
      renderSlots(slotsRowCache);
    });
    foot.appendChild(btn);
  }

  /* Cover + profile (logo) images --------------------------------------- */
  function renderHospitalMedia(h) {
    const coverImg = $('#hpCoverImg');
    const avatarImg = $('#hpProfileImg');

    if (h.cover_image_url) {
      coverImg.src = h.cover_image_url;
      coverImg.style.display = '';
      $('#hpCoverFallback').style.display = 'none';
      coverImg.onerror = () => {
        coverImg.style.display = 'none';
        $('#hpCoverFallback').style.display = '';
      };
    } else {
      coverImg.style.display = 'none';
      coverImg.removeAttribute('src');
      $('#hpCoverFallback').style.display = '';
    }

    if (h.profile_image_url) {
      avatarImg.src = h.profile_image_url;
      avatarImg.style.display = '';
      $('#hpProfileFallback').style.display = 'none';
      avatarImg.onerror = () => {
        avatarImg.style.display = 'none';
        $('#hpProfileFallback').style.display = '';
      };
    }
  }

  function wireImageUpload(hospitalId, kind) {
    const map = {
      cover: ['#hpCoverEdit', '#hpCoverInput', Api.uploadHospitalCoverImage, $('#hpCoverImg')],
      profile: ['#hpProfileEdit', '#hpProfileInput', Api.uploadHospitalProfileImage, $('#hpProfileImg')],
    }[kind];
    if (!map) return;
    const [btnSel, inputSel, uploadFn, imgEl] = map;
    const btn = $(btnSel);
    const input = $(inputSel);
    if (!btn || !input) return;

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      input.value = ''; /* allow picking the same file again */

      const originalHTML = btn.innerHTML;
      btn.classList.add('is-saving');
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Uploading…';
      try {
        const result = await uploadFn(hospitalId, file);
        const url = result.url || result.cover_image_url || result.profile_image_url;
        if (imgEl && url) {
          imgEl.src = url;
          imgEl.style.display = '';
          if (kind === 'cover') $('#hpCoverFallback').style.display = 'none';
          if (kind === 'profile') $('#hpProfileFallback').style.display = 'none';
        }
        window.toast?.(kind === 'cover' ? 'Cover image updated.' : 'Profile image updated.', 'success');
      } catch (err) {
        window.toast?.(err.message || 'Upload failed.', 'error');
      } finally {
        btn.classList.remove('is-saving');
        btn.innerHTML = originalHTML;
      }
    });
  }

  function render(data) {
    const h = data.hospital;

    document.title = `${h.name} · Hospital Profile`;
    $('#hpName').textContent = h.name || '—';
    $('#hpUrdu').textContent = h.urdu_name || '';

    const badges = [
      h.city ? badge(h.city, { icon: 'map-pin' }) : '',
      badge(`${data.doctors.length} doctor${data.doctors.length === 1 ? '' : 's'}`, { icon: 'users', primary: data.doctors.length > 0 }),
      badge(`${h.schedule_count} OPD/OT slot${h.schedule_count === 1 ? '' : 's'}`, { icon: 'clock', primary: h.schedule_count > 0 }),
    ];
    $('#hpBadges').innerHTML = badges.filter(Boolean).join('');

    $('#hpStats').innerHTML =
      statCard('Doctors attached', Utils.number(h.doctor_count), 'users') +
      statCard('Duty slots', Utils.number(h.schedule_count), 'clock') +
      statCard('Specialties', Utils.number((h.specialties || []).length), 'stethoscope') +
      statCard('City', Utils.escape(h.city || '—'), 'map-pin', 'font-size:1rem;');

      const rows = data.doctors;
      doctorsRowCache = rows;
      renderDoctors(rows);
      $('#hpDoctorsEmpty').classList.toggle('hidden', rows.length > 0);
      updateDoctorsNote(rows.length);

    const slots = data.schedules;
    slotsRowCache = slots;
    renderSlots(slots);
  }

  function bindJumps() {
    document.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.querySelector(btn.dataset.jump);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.remove('is-flash');
        /* restart the CSS animation */
        void target.offsetWidth;
        target.classList.add('is-flash');
        history.replaceState(null, '', target.dataset.anchor || btn.dataset.jump);
      });
    });
  }

  async function init() {
    bindJumps();

    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('id'));

    if (!id || !Number.isFinite(id)) {
      $('#profileError').style.display = '';
      $('#profileContent').style.display = 'none';
      return;
    }

    try {
      const data = await Api.get(`/hospitals/${id}`);
      if (!data || !data.hospital || !data.hospital.id) throw new Error('Hospital not found');
      render(data);
      renderHospitalMedia(data.hospital);
      wireImageUpload(id, 'cover');
      wireImageUpload(id, 'profile');

      /* Smooth landing: #doctors / #slots scroll straight to the section. */
      const anchor = window.location.hash;
      if (anchor && document.querySelector(anchor)) {
        setTimeout(() => {
          const target = document.querySelector(anchor);
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.classList.add('is-flash');
        }, 250);
      }
    } catch (err) {
      $('#profileError').style.display = '';
      $('#profileContent').style.display = 'none';
      const msg = $('#profileErrorMsg');
      if (msg) msg.textContent = err.message || 'Please try again.';
    }
  }

  return { init };
})();

window.HospitalProfile = HospitalProfile;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', HospitalProfile.init)
  : HospitalProfile.init();
