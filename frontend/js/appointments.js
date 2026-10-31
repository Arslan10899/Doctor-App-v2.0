/* ==========================================================================
   Doctor Application – Appointments page
   OPD/OT duty schedule per hospital ("hospital_schedules" table), imported
   from the local backup's otSchedules. Patients book appointments in these
   duty slots.
   ========================================================================== */

const Appointments = (() => {
  let all = [];
  let state = { hospital: 'all', day: 'all', search: '' };

  const $ = (s) => document.querySelector(s);

  function applyURLParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('hospital')) state.hospital = params.get('hospital');
    if (params.get('day')) {
      const d = params.get('day');
      state.day = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
    }
    if (params.get('search')) state.search = params.get('search');
  }

  function filtered() {
    const q = state.search.trim().toLowerCase();
    return all.filter((s) => {
      const hospitalOk = state.hospital === 'all' || s.hospital === state.hospital;
      const dayOk = state.day === 'all' || s.day === state.day;
      const text = `${s.doctor_name || ''} ${s.opd_specialty || ''} ${s.hospital || ''}`.toLowerCase();
      return hospitalOk && dayOk && (!q || text.includes(q));
    });
  }

  function row(s) {
    const empty = !s.doctor_name || /no doctor/i.test(s.doctor_name);
    let doctorCell = `<span class="appt-doctor is-empty">${Utils.escape(s.doctor_name || '—')}</span>`;
    if (!empty) {
      /* The duty slots store short names ("Dr. Asif Aziz") while the doctor
         records are longer ("Dr Asif Aziz (Burn, ... )") – link with the core
         name so the search finds the record. */
      const core = s.doctor_name
        .replace(/^Dr\.?\s+/i, '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .trim();
      doctorCell = `<a class="appt-doctor appt-doctor-link" href="doctors.html?v=49&search=${encodeURIComponent(core)}" title="Find this doctor">
           ${Utils.escape(s.doctor_name)}
         </a>`;
    }

    return `
      <tr>
        <td>
          <div class="cell-strong">
            <a class="link-cell" href="hospital-profile.html?v=49&id=${encodeURIComponent(s.hospital_id || '')}"
               title="Open hospital profile">${Utils.escape(s.hospital || '—')}</a>
          </div>
          <div class="text-xs text-muted">${Utils.escape(s.city || '')}</div>
        </td>
        <td>${doctorCell}</td>
        <td>${Utils.escape(s.opd_specialty || '—')}</td>
        <td><span class="day-chip">${Utils.escape(s.day || '—')}</span></td>
        <td>${Utils.escape(s.start_time || '')} – ${Utils.escape(s.end_time || '')}</td>
      </tr>
    `;
  }

  function render() {
    const rows = filtered();
    $('#scheduleTableBody').innerHTML = rows.map(row).join('');
    $('#scheduleEmpty').classList.toggle('hidden', rows.length > 0);
    $('#resultsInfo').textContent = `${rows.length} of ${all.length} duty slots`;
  }

  async function init() {
    applyURLParams();

    try {
      const [slots, hospitals] = await Promise.all([
        Api.get('/hospital-schedules', { limit: 1000 }),
        Api.get('/hospitals/directory'),
      ]);
      all = slots || [];

      const select = $('#scheduleHospital');
      (hospitals || []).forEach((h) => {
        /* Only hospitals that actually have duty slots, plus keep the
           URL-selected one always available. */
        if (h.schedules > 0 || h.name === state.hospital) {
          const opt = document.createElement('option');
          opt.value = h.name;
          opt.textContent = h.name;
          select.appendChild(opt);
        }
      });

      $('#scheduleHospital').value =
        state.hospital !== 'all' && [...select.options].some((o) => o.value === state.hospital)
          ? state.hospital
          : 'all';
      if ($('#scheduleHospital').value !== state.hospital) state.hospital = 'all';

      $('#scheduleDay').value = state.day !== 'all' ? state.day : 'all';
      if ($('#scheduleDay').value !== state.day) state.day = 'all';
      $('#scheduleSearch').value = state.search;

      render();
    } catch (err) {
      $('#resultsInfo').textContent = err.message || 'Could not load the schedule.';
    }

    $('#scheduleHospital')?.addEventListener('change', (e) => {
      state.hospital = e.target.value;
      render();
    });
    $('#scheduleDay')?.addEventListener('change', (e) => {
      state.day = e.target.value;
      render();
    });
    $('#scheduleSearch')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      render();
    });
  }

  return { init };
})();

window.Appointments = Appointments;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', Appointments.init)
  : Appointments.init();
