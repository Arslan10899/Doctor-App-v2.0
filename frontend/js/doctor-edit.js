/* ==========================================================================
   Doctor Application – Full doctor editor
   Edits every field of the local doctor record, including clinics,
   weekly timings, OPD and OT schedule.
   ========================================================================== */

(function () {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const state = {
    id: null,
    doctor: null,
    clinics: [],
    ot: [],
    opd: null,
    dirty: false,
    saving: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const form = () => document.getElementById('doctorEditForm');

  /* ---------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------- */
  function parseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }

  function daySort(a, b) {
    const ai = DAYS.findIndex((d) => String(a).toLowerCase().startsWith(d.toLowerCase()));
    const bi = DAYS.findIndex((d) => String(b).toLowerCase().startsWith(d.toLowerCase()));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  }

  function sortDays(list) {
    return Array.from(list || []).sort(daySort);
  }

  function dayLabel(day) {
    return String(day).split('-')[0].trim();
  }

  function setValue(name, value) {
    const field = form()?.elements.namedItem(name);
    if (field) field.value = value === null || value === undefined ? '' : value;
  }

  function getValue(name) {
    const field = form()?.elements.namedItem(name);
    return field ? String(field.value || '').trim() : '';
  }

  function setStatus(text, tone) {
    const label = $('#editorStatus');
    const dot = $('#editorDot');
    if (label) label.textContent = text;
    if (dot) dot.className = `dot dot-${tone || 'warning'}`;
  }

  function markDirty() {
    if (state.saving) return;
    state.dirty = true;
    setStatus('Unsaved changes', 'warning');
  }

  function escapeAttr(value) {
    return Utils.escape(value === null || value === undefined ? '' : String(value));
  }

  /* ---------------------------------------------------------------------
   * Clinic model
   * ------------------------------------------------------------------- */
  function blankClinic() {
    return { clinicName: '', address: '', timings: {} };
  }

  function normalizeClinic(raw) {
    const c = raw && typeof raw === 'object' ? raw : {};
    return {
      clinicName: c.clinicName || c.hospitalName || c.name || '',
      address: c.address || '',
      timings: c.timings && typeof c.timings === 'object' ? c.timings : {},
    };
  }

  /** Map "Monday - پیر " style keys back to their canonical day. */
  function timingKeyFor(timings, day) {
    const found = Object.keys(timings || {}).find((key) =>
      String(key).toLowerCase().startsWith(day.toLowerCase())
    );
    return found || day;
  }

  function renderTimingRows(clinic, clinicIndex) {
    return DAYS.map((day) => {
      const key = timingKeyFor(clinic.timings, day);
      const entry = clinic.timings[key] || {};
      const closed = entry.isClosed === true || entry.isClosed === 'true';
      return `<div class="timing-row ${closed ? 'is-closed' : ''}" data-timing-row data-clinic-index="${clinicIndex}">
        <span class="timing-day" title="${escapeAttr(key)}">${Utils.escape(day)}</span>
        <label class="timing-closed">
          <input type="checkbox" class="checkbox" data-timing-closed ${closed ? 'checked' : ''} />
          Closed
        </label>
        <input type="hidden" data-day-key value="${escapeAttr(key)}" />
        <input class="input" type="text" data-open value="${escapeAttr(entry.open || '')}"
               placeholder="2:00 PM" ${closed ? 'disabled' : ''} aria-label="${Utils.escape(day)} opening time" />
        <input class="input" type="text" data-close value="${escapeAttr(entry.close || '')}"
               placeholder="8:00 PM" ${closed ? 'disabled' : ''} aria-label="${Utils.escape(day)} closing time" />
      </div>`;
    }).join('');
  }

  function renderClinics() {
    const host = $('#clinicsHost');
    if (!host) return;

    if (!state.clinics.length) {
      host.innerHTML = `<div class="editor-empty">
        ${window.Icon('building-2')}
        <span>No clinics recorded. Use “Add clinic” to create one.</span>
      </div>`;
      return;
    }

    host.innerHTML = state.clinics
      .map(
        (clinic, index) => `<div class="editor-item" data-clinic data-index="${index}">
          <div class="editor-item-head">
            <div class="editor-item-title">
              ${window.Icon('building-2')}
              <span>Clinic ${index + 1}</span>
              ${clinic.clinicName ? `<span class="badge badge-secondary">${Utils.escape(clinic.clinicName)}</span>` : ''}
            </div>
            <button type="button" class="icon-btn icon-btn-sm" data-remove-clinic="${index}" aria-label="Remove clinic">
              ${window.Icon('trash-2')}
            </button>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Clinic / hospital name</label>
              <input class="input" type="text" data-clinic-field="clinicName" value="${escapeAttr(clinic.clinicName)}" />
            </div>
            <div class="field">
              <label>Address</label>
              <input class="input" type="text" data-clinic-field="address" value="${escapeAttr(clinic.address)}" />
            </div>
          </div>

          <div style="margin-top:.875rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
              <div class="editor-subtle" style="font-weight:600;color:var(--foreground);">Weekly timings</div>
              <button type="button" class="btn btn-outline btn-sm" data-copy-monday="${index}">
                Copy Monday to all
              </button>
            </div>
            <div class="timings-editor">${renderTimingRows(clinic, index)}</div>
          </div>
        </div>`
      )
      .join('');
  }

  function syncClinics() {
    const host = $('#clinicsHost');
    if (!host) return;

    const items = Array.from(host.querySelectorAll('[data-clinic]'));
    state.clinics = items.map((item) => {
      const clinic = {
        clinicName: item.querySelector('[data-clinic-field="clinicName"]')?.value.trim() || '',
        address: item.querySelector('[data-clinic-field="address"]')?.value.trim() || '',
        timings: {},
      };

      Array.from(item.querySelectorAll('[data-timing-row]')).forEach((row) => {
        const key = row.querySelector('[data-day-key]')?.value || '';
        const closed = !!row.querySelector('[data-timing-closed]')?.checked;
        const open = row.querySelector('[data-open]')?.value.trim() || '';
        const close = row.querySelector('[data-close]')?.value.trim() || '';
        // Do not create records for days the doctor does not work.
        if (!closed && !open && !close) return;
        clinic.timings[key] = { isClosed: closed, open, close };
      });

      return clinic;
    });
  }

  /* ---------------------------------------------------------------------
   * OT model
   * ------------------------------------------------------------------- */
  function blankOt() {
    return { hospitalCity: '', hospitalName: '', specialty: '', days: [], time: '', yesNo: 'Yes' };
  }

  function normalizeOt(raw) {
    const o = raw && typeof raw === 'object' ? raw : {};
    return {
      hospitalCity: o.hospitalCity || '',
      hospitalName: o.hospitalName || o.clinicName || '',
      specialty: o.specialty || o.opdSpecialty || '',
      days: Array.isArray(o.days) ? sortDays(o.days.map(dayLabel)) : [],
      time: o.time || (o.startTime ? `${o.startTime} - ${o.endTime || ''}` : ''),
      yesNo: o.yesNo || 'Yes',
    };
  }

  function renderDayPicker(selected, attrName) {
    const list = Array.isArray(selected) ? selected : [];
    return DAYS.map((day) => {
      const checked = list.some((value) => String(value).toLowerCase() === day.toLowerCase());
      return `<label class="day-pick">
        <input type="checkbox" ${attrName} value="${day}" ${checked ? 'checked' : ''} />
        ${day.slice(0, 3)}
      </label>`;
    }).join('');
  }

  function renderOt() {
    const host = $('#otHost');
    if (!host) return;

    if (!state.ot.length) {
      host.innerHTML = `<div class="editor-empty">
        ${window.Icon('scissors')}
        <span>No OT schedule recorded. Use “Add OT row” to create one.</span>
      </div>`;
      return;
    }

    host.innerHTML = state.ot
      .map(
        (row, index) => `<div class="editor-item" data-ot data-index="${index}">
          <div class="editor-item-head">
            <div class="editor-item-title">
              ${window.Icon('scissors')}
              <span>OT row ${index + 1}</span>
              ${row.days.length ? `<span class="badge badge-secondary">${Utils.escape(row.days.map(dayLabel).join(', '))}</span>` : ''}
            </div>
            <button type="button" class="icon-btn icon-btn-sm" data-remove-ot="${index}" aria-label="Remove OT row">
              ${window.Icon('trash-2')}
            </button>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Hospital</label>
              <input class="input" type="text" data-ot-field="hospitalName" value="${escapeAttr(row.hospitalName)}" />
            </div>
            <div class="field">
              <label>City</label>
              <input class="input" type="text" data-ot-field="hospitalCity" value="${escapeAttr(row.hospitalCity)}" />
            </div>
            <div class="field">
              <label>Specialty</label>
              <input class="input" type="text" data-ot-field="specialty" value="${escapeAttr(row.specialty)}" />
            </div>
            <div class="field">
              <label>Time</label>
              <input class="input" type="text" data-ot-field="time" value="${escapeAttr(row.time)}" placeholder="8:00 PM - 2:00 PM" />
            </div>
          </div>

          <div class="field" style="margin-top:.75rem;">
            <label>Days</label>
            <div class="day-picker">${renderDayPicker(row.days, 'data-ot-day')}</div>
          </div>
        </div>`
      )
      .join('');
  }

  function syncOt() {
    const host = $('#otHost');
    if (!host) return;

    state.ot = Array.from(host.querySelectorAll('[data-ot]')).map((item) => {
      const days = Array.from(item.querySelectorAll('[data-ot-day]:checked')).map((input) => input.value);
      return {
        hospitalCity: item.querySelector('[data-ot-field="hospitalCity"]')?.value.trim() || '',
        hospitalName: item.querySelector('[data-ot-field="hospitalName"]')?.value.trim() || '',
        specialty: item.querySelector('[data-ot-field="specialty"]')?.value.trim() || '',
        time: item.querySelector('[data-ot-field="time"]')?.value.trim() || '',
        days: sortDays(days),
        yesNo: 'Yes',
      };
    });
  }

  /* ---------------------------------------------------------------------
   * OPD model
   * ------------------------------------------------------------------- */
  function setOpdEnabled(enabled) {
    const sw = $('#opdSwitch');
    const fields = $('#opdFields');
    const empty = $('#opdEmpty');
    if (sw) sw.setAttribute('aria-checked', enabled ? 'true' : 'false');
    if (fields) fields.style.display = enabled ? 'flex' : 'none';
    if (empty) empty.style.display = enabled ? 'none' : 'flex';
  }

  function isOpdEnabled() {
    return $('#opdSwitch')?.getAttribute('aria-checked') === 'true';
  }

  function loadOpd(value) {
    const parsed = parseJson(value);
    const enabled =
      !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0;

    state.opd = enabled ? parsed : null;
    setOpdEnabled(enabled);

    const current = state.opd || {};
    const hospital = $('#f-opd_hospital');
    const specialty = $('#f-opd_specialty');
    const time = $('#f-opd_time');
    if (hospital) hospital.value = current.hospitalName || '';
    if (specialty) specialty.value = current.specialty || '';
    if (time) time.value = current.time || '';

    const daysHost = $('#opdDays');
    if (daysHost) daysHost.innerHTML = renderDayPicker(current.days || [], 'data-opd-day');
  }

  function readOpd() {
    if (!isOpdEnabled()) return 'No';
    const days = Array.from(document.querySelectorAll('[data-opd-day]:checked')).map((i) => i.value);
    return JSON.stringify({
      hospitalName: $('#f-opd_hospital')?.value.trim() || '',
      specialty: $('#f-opd_specialty')?.value.trim() || '',
      days: sortDays(days),
      time: $('#f-opd_time')?.value.trim() || '',
      yesNo: 'Yes',
    });
  }

  /* ---------------------------------------------------------------------
   * Switches
   * ------------------------------------------------------------------- */
  function bindSwitch(id, onChange) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      const next = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', next ? 'true' : 'false');
      markDirty();
      if (onChange) onChange(next);
    });
  }

  /* ---------------------------------------------------------------------
   * Load
   * ------------------------------------------------------------------- */
  async function loadSpecialties() {
    try {
      const list = await Api.specialties();
      const datalist = $('#specialtyOptions');
      if (datalist) {
        datalist.innerHTML = list
          .map((item) => `<option value="${escapeAttr(item.name)}"></option>`)
          .join('');
      }
    } catch (err) {
      /* datalist is optional */
    }
  }

  async function load() {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('id'));

    const formEl = form();
    const errorBox = $('#editorError');
    const errorMsg = $('#editorErrorMsg');

    if (!Number.isFinite(id) || id <= 0) {
      formEl.style.display = 'none';
      errorBox.style.display = 'flex';
      errorMsg.textContent = 'Invalid doctor ID.';
      $('#editorTitle').textContent = 'Doctor not found';
      $('#editorSub').textContent = 'The link is missing or incorrect.';
      return;
    }

    state.id = id;
    const cancel = $('#cancelEdit');
    if (cancel) cancel.href = `doctor-profile.html?v=33&id=${id}`;
    const viewProfile = $('#viewProfile');
    if (viewProfile) viewProfile.href = `doctor-profile.html?v=33&id=${id}`;
    const cancelBottom = $('#cancelEditBottom');
    if (cancelBottom) cancelBottom.href = `doctor-profile.html?v=33&id=${id}`;

    try {
      const doctor = await Api.getDoctor(id);
      state.doctor = doctor;

      const name = doctor.name || 'Unknown Doctor';
      document.title = `Edit ${name} · Doctor Application`;
      $('#editorTitle').textContent = `Edit ${name}`;
      $('#editorSub').textContent = [doctor.specialty, doctor.qualification].filter(Boolean).join(' · ') || 'Complete doctor record';
      $('#editorCrumb').textContent = `Doctor #${doctor.id}`;

      [
        'name',
        'urdu_name',
        'email',
        'phone',
        'whatsapp',
        'gender',
        'status',
        'avatar_url',
        'specialty',
        'qualification',
        'experience_years',
        'hospital',
        'city',
        'country',
        'consultation_fee',
        'rating',
        'views_count',
        'total_calls',
        'doctors_message',
        'diseases',
        'bio',
      ].forEach((key) => setValue(key, doctor[key]));

      setValue('country', doctor.country || 'Pakistan');
      setValue('status', doctor.status || 'Active');
      setValue('experience_years', doctor.experience_years || 0);
      setValue('consultation_fee', doctor.consultation_fee || 0);
      setValue('rating', doctor.rating || 0);
      setValue('views_count', doctor.views_count || 0);
      setValue('total_calls', doctor.total_calls || 0);

      const preview = $('#editAvatarPreview');
      if (preview) preview.innerHTML = Utils.avatar(doctor, 'avatar-xl');

      const sehatSwitch = $('#sehatSwitch');
      if (sehatSwitch) {
        sehatSwitch.setAttribute('aria-checked', Number(doctor.sehat_card_empaneled) ? 'true' : 'false');
      }

      const clinics = parseJson(doctor.clinics_json);
      state.clinics = Array.isArray(clinics) ? clinics.map(normalizeClinic) : [];

      const ot = parseJson(doctor.ot_schedule);
      state.ot = Array.isArray(ot) ? ot.map(normalizeOt) : [];

      renderClinics();
      renderOt();
      loadOpd(doctor.opd_info);
      loadSpecialties();

      setStatus('All changes saved', 'success');
      state.dirty = false;

      formEl.addEventListener('input', markDirty);
      formEl.addEventListener('change', markDirty);

      formEl.addEventListener('submit', submit);
    } catch (err) {
      formEl.style.display = 'none';
      errorBox.style.display = 'flex';
      errorMsg.textContent = err.message || 'Something went wrong.';
      $('#editorTitle').textContent = 'Doctor not found';
      $('#editorSub').textContent = 'Could not load this doctor.';
    }
  }

  /* ---------------------------------------------------------------------
   * Save
   * ------------------------------------------------------------------- */
  function collect() {
    syncClinics();
    syncOt();

    const clinics = state.clinics
      .map((clinic) => ({
        clinicName: clinic.clinicName,
        address: clinic.address,
        timings: clinic.timings,
      }))
      .filter((clinic) => clinic.clinicName || clinic.address || Object.keys(clinic.timings).length);

    const payload = {
      name: getValue('name'),
      urdu_name: getValue('urdu_name'),
      email: getValue('email'),
      phone: getValue('phone'),
      whatsapp: getValue('whatsapp'),
      status: getValue('status') || 'Active',
      avatar_url: getValue('avatar_url'),
      specialty: getValue('specialty'),
      qualification: getValue('qualification'),
      experience_years: Number(getValue('experience_years') || 0),
      hospital: getValue('hospital'),
      city: getValue('city'),
      country: getValue('country') || 'Pakistan',
      consultation_fee: Number(getValue('consultation_fee') || 0),
      rating: Number(getValue('rating') || 0),
      views_count: Number(getValue('views_count') || 0),
      total_calls: Number(getValue('total_calls') || 0),
      sehat_card_empaneled: $('#sehatSwitch')?.getAttribute('aria-checked') === 'true' ? 1 : 0,
      doctors_message: getValue('doctors_message'),
      diseases: getValue('diseases'),
      bio: getValue('bio'),
      clinics_json: JSON.stringify(clinics),
      timings_json: JSON.stringify(clinics[0]?.timings || {}),
      ot_schedule: JSON.stringify(state.ot),
      opd_info: readOpd(),
    };

    const gender = getValue('gender');
    if (gender) payload.gender = gender;

    return payload;
  }

  async function submit(event) {
    event.preventDefault();
    if (state.saving) return;

    const payload = collect();
    if (!payload.name || !payload.email || !payload.specialty) {
      toast('Name, email and specialty are required.', 'warning');
      return;
    }

    const button = $('#saveDoctorBtn');
    const original = button.innerHTML;
    state.saving = true;
    button.disabled = true;
    button.textContent = 'Saving…';
    setStatus('Saving…', 'warning');

    try {
      const doctor = await Api.updateDoctor(state.id, payload);
      setStatus('Saved', 'success');

      const avatarFile = document.getElementById('avatarInput')?.files?.[0];
      if (avatarFile) {
        try {
          await Api.uploadAvatar(doctor.id, avatarFile);
        } catch (err) {
          toast(`Avatar upload failed: ${err.message}`, 'warning');
        }
      }

      state.dirty = false;
      toast(`${doctor.name} updated successfully.`, 'success');

      setTimeout(() => {
        window.location.href = `doctor-profile.html?v=33&id=${encodeURIComponent(doctor.id)}`;
      }, 600);
    } catch (err) {
      toast(err.message, 'error');
      setStatus('Save failed', 'destructive');
      button.disabled = false;
      button.innerHTML = original;
      state.saving = false;
    }
  }

  /* ---------------------------------------------------------------------
   * Repeated-row interactions (event delegation)
   * ------------------------------------------------------------------- */
  function bindRows() {
    const clinicsHost = $('#clinicsHost');
    if (clinicsHost) {
      clinicsHost.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('[data-remove-clinic]');
        if (removeBtn) {
          syncClinics();
          state.clinics.splice(Number(removeBtn.dataset.removeClinic), 1);
          renderClinics();
          markDirty();
          return;
        }

        const copyBtn = event.target.closest('[data-copy-monday]');
        if (copyBtn) {
          const item = copyBtn.closest('[data-clinic]');
          const rows = Array.from(item.querySelectorAll('[data-timing-row]'));
          const first = rows[0];
          if (!first) return;
          const firstOpen = first.querySelector('[data-open]')?.value || '';
          const firstClose = first.querySelector('[data-close]')?.value || '';
          const firstClosed = first.querySelector('[data-timing-closed]')?.checked;
          rows.slice(1).forEach((row) => {
            row.querySelector('[data-open]').value = firstOpen;
            row.querySelector('[data-close]').value = firstClose;
            row.querySelector('[data-timing-closed]').checked = firstClosed;
            row.classList.toggle('is-closed', !!firstClosed);
            row.querySelectorAll('[data-open],[data-close]').forEach((input) => {
              input.disabled = !!firstClosed;
            });
          });
          markDirty();
        }
      });

      clinicsHost.addEventListener('change', (event) => {
        if (!event.target.matches('[data-timing-closed]')) return;
        const row = event.target.closest('[data-timing-row]');
        if (!row) return;
        row.classList.toggle('is-closed', event.target.checked);
        row.querySelectorAll('[data-open],[data-close]').forEach((input) => {
          input.disabled = event.target.checked;
        });
      });
    }

    const otHost = $('#otHost');
    if (otHost) {
      otHost.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('[data-remove-ot]');
        if (!removeBtn) return;
        syncOt();
        state.ot.splice(Number(removeBtn.dataset.removeOt), 1);
        renderOt();
        markDirty();
      });
    }

    $('#addClinicBtn')?.addEventListener('click', () => {
      syncClinics();
      state.clinics.push(blankClinic());
      renderClinics();
      markDirty();

      const items = document.querySelectorAll('[data-clinic]');
      items[items.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    $('#addOtBtn')?.addEventListener('click', () => {
      syncOt();
      state.ot.push(blankOt());
      renderOt();
      markDirty();

      const items = document.querySelectorAll('[data-ot]');
      items[items.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    bindSwitch('sehatSwitch');
    bindSwitch('opdSwitch', (enabled) => setOpdEnabled(enabled));

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
      avatarInput.addEventListener('change', () => {
        const file = avatarInput.files?.[0];
        const preview = $('#editAvatarPreview');
        if (!file || !preview) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          preview.innerHTML = `<div class="avatar avatar-xl"><img src="${event.target.result}" alt="Preview"></div>`;
        };
        reader.readAsDataURL(file);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindRows();
    load();
  });
})();
