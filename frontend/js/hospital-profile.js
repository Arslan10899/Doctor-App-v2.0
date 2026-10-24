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
              <a class="cell-strong link-cell" href="doctor-profile.html?v=23&id=${encodeURIComponent(d.id)}">${Utils.escape(d.name)}</a>
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
      : `<a class="link-cell" href="doctors.html?v=23&search=${encodeURIComponent(coreDoctorName(s.doctor_name))}"
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
    $('#hpDoctorsBody').innerHTML = rows.map(doctorRow).join('');
    $('#hpDoctorsEmpty').classList.toggle('hidden', rows.length > 0);
    $('#hpDoctorsNote').textContent =
      rows.length > 0
        ? `${rows.length} doctor record${rows.length === 1 ? '' : 's'} matched from the backup clinic addresses.`
        : 'Doctors whose clinic address references this hospital.';

    const slots = data.schedules;
    $('#hpSlotsBody').innerHTML = slots.map(slotRow).join('');
    $('#hpSlotsEmpty').classList.toggle('hidden', slots.length > 0);
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
