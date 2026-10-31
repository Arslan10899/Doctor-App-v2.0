/* ==========================================================================
   Doctor Application – Doctors page
   ========================================================================== */

const Doctors = (() => {
  const state = {
    search: '',
    specialty: 'all',
    status: 'all',
    hospital: 'all',
    city: 'all',
    sortBy: 'created_at',
    sortDir: 'desc',
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
    editingId: null,
    pendingDeleteId: null,
  };

  /* ---------------------------------------------------------------------
   * Rendering
   * ------------------------------------------------------------------- */
  function renderRows(items) {
    const host = document.getElementById('doctorsTableBody');
    if (!host) return;

    if (!items.length) {
      host.innerHTML = `<tr><td colspan="7">
        <div class="empty-state">
          ${window.Icon('search')}
          <strong>No doctors found</strong>
          <span>Try changing the filters or add a new doctor.</span>
        </div>
      </td></tr>`;
      return;
    }

    host.innerHTML = items
      .map(
        (doctor) => `
        <tr data-id="${doctor.id}">
          <td>
            <div style="display:flex;align-items:center;gap:.75rem;">
              ${Utils.avatar(doctor)}
              <div style="min-width:0;">
                <a class="cell-strong link-cell" href="doctor-profile.html?v=49&id=${encodeURIComponent(doctor.id)}">${Utils.escape(doctor.name)}</a>
                <div class="cell-muted text-xs">${Utils.escape(doctor.email)}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="cell-strong">${Utils.escape(doctor.specialty)}</div>
            <div class="cell-muted text-xs">${Utils.escape(doctor.qualification || '—')}</div>
          </td>
          <td>
            <div class="cell-strong" style="max-width:14rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${Utils.escape(doctor.hospital || '')}">${Utils.escape(doctor.hospital || '—')}</div>
            <div class="cell-muted text-xs">${Utils.escape(doctor.city || '')}</div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:.5rem;">
              ${Utils.stars(doctor.rating)}
              <span class="text-xs text-muted">${Number(doctor.rating || 0).toFixed(1)}</span>
            </div>
          </td>
          <td class="cell-strong">${Utils.money(doctor.consultation_fee)}</td>
          <td>${Utils.statusBadge(doctor.status)}</td>
          <td class="text-right">
            <div class="dropdown" style="display:inline-block;">
              <button type="button" class="icon-btn icon-btn-sm" data-dropdown-toggle aria-label="Row actions">
                ${window.Icon('more-horizontal')}
              </button>
              <div class="dropdown-menu">
                <button type="button" class="dropdown-item" data-action="view" data-id="${doctor.id}">
                  ${window.Icon('eye')} View details
                </button>
                <button type="button" class="dropdown-item" data-action="edit" data-id="${doctor.id}">
                  ${window.Icon('pencil')} Edit doctor
                </button>
                <div class="dropdown-separator"></div>
                <button type="button" class="dropdown-item danger" data-action="delete" data-id="${doctor.id}">
                  ${window.Icon('trash-2')} Delete
                </button>
              </div>
            </div>
          </td>
        </tr>`
      )
      .join('');

    host.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const { action, id } = button.dataset;
        if (action === 'edit') openEditor(Number(id));
        if (action === 'view') viewDoctor(Number(id));
        if (action === 'delete') askDelete(Number(id));
      });
    });
  }

  function renderPagination() {
    const host = document.getElementById('pagination');
    if (!host) return;

    const info = document.getElementById('resultsInfo');
    if (info) {
      const start = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
      const end = Math.min(state.page * state.limit, state.total);
      info.textContent = `Showing ${start}–${end} of ${Utils.number(state.total)} doctors`;
    }

    if (state.pages <= 1) {
      host.innerHTML = '';
      return;
    }

    const buttons = [];
    buttons.push(
      `<button type="button" class="page-btn" data-page="${state.page - 1}" ${
        state.page === 1 ? 'disabled' : ''
      }>${window.Icon('chevron-left')}</button>`
    );

    for (let page = 1; page <= state.pages; page += 1) {
      if (state.pages > 7 && page > 2 && page < state.pages - 1) {
        if (page === 3 || page === state.pages - 2) {
          buttons.push('<span class="page-btn" style="pointer-events:none;">…</span>');
        }
        continue;
      }
      buttons.push(
        `<button type="button" class="page-btn ${page === state.page ? 'is-active' : ''}" data-page="${page}">${page}</button>`
      );
    }

    buttons.push(
      `<button type="button" class="page-btn" data-page="${state.page + 1}" ${
        state.page === state.pages ? 'disabled' : ''
      }>${window.Icon('chevron-right')}</button>`
    );

    host.innerHTML = buttons.join('');
    host.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        const page = Number(button.dataset.page);
        if (page >= 1 && page <= state.pages) {
          state.page = page;
          loadDoctors();
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
   * Data
   * ------------------------------------------------------------------- */
  async function loadDoctors() {
    const body = document.getElementById('doctorsTableBody');
    if (body) {
      body.innerHTML = Array.from({ length: 5 })
        .map(
          () => `<tr><td colspan="7"><div class="skeleton" style="height:2.25rem;"></div></td></tr>`
        )
        .join('');
    }

    try {
      const data = await Api.listDoctors({
        search: state.search,
        specialty: state.specialty,
        status: state.status,
        hospital: state.hospital,
        city: state.city,
        sort_by: state.sortBy,
        sort_dir: state.sortDir,
        page: state.page,
        limit: state.limit,
      });

      state.total = data.total;
      state.pages = data.pages;
      renderRows(data.items);
      renderPagination();
    } catch (err) {
      if (body) {
        body.innerHTML = `<tr><td colspan="7">
          <div class="empty-state">
            ${window.Icon('x-circle')}
            <strong>Could not load doctors</strong>
            <span>${Utils.escape(err.message)}</span>
          </div>
        </td></tr>`;
      }
      toast(err.message, 'error');
    }
  }

  /* ---------------------------------------------------------------------
   * Filters
   * ------------------------------------------------------------------- */
  async function loadFilters() {
    try {
      const [specialties, hospitals, cities] = await Promise.all([
        Api.specialties(),
        Api.hospitals(),
        Api.cities().catch(() => []),
      ]);

      const specialtySelect = document.getElementById('specialtyFilter');
      if (specialtySelect) {
        specialtySelect.innerHTML =
          '<option value="all">All specialties</option>' +
          specialties
            .map((item) => `<option value="${Utils.escape(item.name)}">${Utils.escape(item.name)} (${item.doctors})</option>`)
            .join('');
        if (state.specialty !== 'all') specialtySelect.value = state.specialty;
        if (specialtySelect.value !== state.specialty) state.specialty = 'all';
      }

      const hospitalSelect = document.getElementById('hospitalFilter');
      if (hospitalSelect) {
        hospitalSelect.innerHTML =
          '<option value="all">All hospitals</option>' +
          hospitals.map((item) => `<option value="${Utils.escape(item)}">${Utils.escape(item)}</option>`).join('');
      }

      const citySelect = document.getElementById('cityFilter');
      if (citySelect) {
        citySelect.innerHTML =
          '<option value="all">All cities</option>' +
          cities
            .map((item) => `<option value="${Utils.escape(item.name)}">${Utils.escape(item.name)} (${item.doctors})</option>`)
            .join('');
        if (state.city !== 'all') citySelect.value = state.city;
        if (citySelect.value !== state.city) state.city = 'all';
      }
    } catch (err) {
      /* filters stay with the default "all" option */
    }
  }

  /* ---------------------------------------------------------------------
   * Create / edit modal
   * ------------------------------------------------------------------- */
  const form = () => document.getElementById('doctorForm');

  function setFormValue(name, value) {
    const field = form()?.elements.namedItem(name);
    if (field) field.value = value ?? '';
  }

  function getFormData() {
    const data = Object.fromEntries(new FormData(form()).entries());
    return {
      name: (data.name || '').trim(),
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      specialty: (data.specialty || '').trim(),
      qualification: (data.qualification || '').trim(),
      experience_years: Number(data.experience_years || 0),
      hospital: (data.hospital || '').trim(),
      city: (data.city || '').trim(),
      country: (data.country || 'Pakistan').trim(),
      consultation_fee: Number(data.consultation_fee || 0),
      rating: Number(data.rating || 0),
      status: data.status || 'Active',
      gender: data.gender || '',
      bio: (data.bio || '').trim(),
    };
  }

  async function openModal(id = null) {
    state.editingId = id;
    const modal = document.getElementById('doctorModal');
    const title = document.getElementById('doctorModalTitle');
    const submit = document.getElementById('doctorModalSubmit');

    if (!modal) return;

    form()?.reset();
    setFormValue('country', 'Pakistan');
    setFormValue('status', 'Active');
    setFormValue('rating', '0');
    setFormValue('avatar_url', '');

    const preview = document.getElementById('avatarPreview');
    if (preview) {
      preview.innerHTML = Utils.avatar({ name: 'New Doctor' });
      preview.dataset.url = '';
    }

    if (id) {
      try {
        const doctor = await Api.getDoctor(id);
        if (title) title.textContent = 'Edit doctor';
        if (submit) submit.textContent = 'Save changes';

        ['name', 'email', 'phone', 'specialty', 'qualification', 'experience_years', 'hospital', 'city',
          'country', 'consultation_fee', 'rating', 'status', 'gender', 'bio'].forEach((key) =>
          setFormValue(key, doctor[key])
        );

        if (preview) {
          preview.innerHTML = Utils.avatar(doctor);
          preview.dataset.url = doctor.avatar_url || '';
        }
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
    } else {
      if (title) title.textContent = 'Add new doctor';
      if (submit) submit.textContent = 'Add doctor';
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    document.getElementById('doctorModal')?.classList.remove('open');
    document.body.style.overflow = '';
    state.editingId = null;
  }

  async function submitForm(event) {
    event.preventDefault();
    const submit = document.getElementById('doctorModalSubmit');
    const payload = getFormData();

    if (!payload.name || !payload.email || !payload.specialty) {
      toast('Name, email and specialty are required.', 'warning');
      return;
    }

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Saving…';

    try {
      let doctor;
      if (state.editingId) {
        doctor = await Api.updateDoctor(state.editingId, payload);
        toast(`${doctor.name} updated successfully.`, 'success');
      } else {
        doctor = await Api.createDoctor(payload);
        toast(`${doctor.name} added to the clinic.`, 'success');
      }

      const avatarFile = document.getElementById('avatarInput')?.files?.[0];
      if (avatarFile) {
        try {
          await Api.uploadAvatar(doctor.id, avatarFile);
          toast('Avatar uploaded.', 'success');
        } catch (err) {
          toast(`Avatar upload failed: ${err.message}`, 'warning');
        }
      }

      closeModal();
      loadDoctors();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  }

  /* ---------------------------------------------------------------------
   * View doctor
   * ------------------------------------------------------------------- */
  async function viewDoctor(id) {
    window.location.href = `doctor-profile.html?v=49&id=${encodeURIComponent(id)}`;
  }

  function openEditor(id) {
    window.location.href = `doctor-edit.html?v=49&id=${encodeURIComponent(id)}`;
  }

  function detailRow(iconName, label, value) {
    return `<div style="display:flex;gap:.625rem;align-items:flex-start;padding:.625rem;border:1px solid var(--border);border-radius:var(--radius-md);">
      <span style="color:var(--muted-foreground);margin-top:.125rem;">${window.Icon(iconName)}</span>
      <span style="min-width:0;">
        <span class="text-xs text-muted" style="display:block;">${Utils.escape(label)}</span>
        <span class="text-sm" style="font-weight:500;">${Utils.escape(String(value))}</span>
      </span>
    </div>`;
  }

  function closeViewModal() {
    document.getElementById('viewModal')?.classList.remove('open');
    if (!document.querySelector('.modal-backdrop.open')) document.body.style.overflow = '';
  }

  /* ---------------------------------------------------------------------
   * Delete
   * ------------------------------------------------------------------- */
  function askDelete(id) {
    state.pendingDeleteId = id;
    const modal = document.getElementById('confirmModal');
    const name = document.getElementById('confirmDoctorName');
    const row = document.querySelector(`tr[data-id="${id}"] .cell-strong`);
    if (name) name.textContent = row ? row.textContent.trim() : 'this doctor';
    modal?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeConfirm() {
    document.getElementById('confirmModal')?.classList.remove('open');
    if (!document.querySelector('.modal-backdrop.open')) document.body.style.overflow = '';
    state.pendingDeleteId = null;
  }

  async function confirmDelete() {
    const id = state.pendingDeleteId;
    const button = document.getElementById('confirmDeleteBtn');
    if (!id) return;

    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
      await Api.deleteDoctor(id);
      toast('Doctor deleted.', 'success');
      closeConfirm();
      loadDoctors();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Delete doctor';
    }
  }

  /* ---------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------- */
  function init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('search')) {
      state.search = params.get('search');
      const input = document.getElementById('doctorsSearch');
      if (input) input.value = state.search;
    }
    if (params.get('city')) {
      state.city = params.get('city');
    }
    if (params.get('specialty')) {
      state.specialty = params.get('specialty');
    }

    const search = document.getElementById('doctorsSearch');
    if (search) {
      search.addEventListener(
        'input',
        Utils.debounce(() => {
          state.search = search.value.trim();
          state.page = 1;
          loadDoctors();
        }, 350)
      );
    }

    [
      ['specialtyFilter', 'specialty'],
      ['statusFilter', 'status'],
      ['hospitalFilter', 'hospital'],
      ['cityFilter', 'city'],
    ].forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.addEventListener('change', () => {
        state[key] = element.value;
        state.page = 1;
        loadDoctors();
      });
    });

    document.querySelectorAll('[data-sort]').forEach((header) => {
      header.addEventListener('click', () => {
        const key = header.dataset.sort;
        if (state.sortBy === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortBy = key;
          state.sortDir = 'asc';
        }
        loadDoctors();
      });
    });

    const addBtn = document.getElementById('addDoctorBtn');
    if (addBtn) addBtn.addEventListener('click', () => openModal(null));

    const doctorForm = document.getElementById('doctorForm');
    if (doctorForm) doctorForm.addEventListener('submit', submitForm);

    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('closeViewBtn')?.addEventListener('click', closeViewModal);
    document.getElementById('cancelConfirmBtn')?.addEventListener('click', closeConfirm);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (event) => {
        if (event.target !== backdrop) return;
        backdrop.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.modal-backdrop.open').forEach((modal) => {
        modal.classList.remove('open');
      });
      document.body.style.overflow = '';
    });

    const exportBtn = document.getElementById('exportDoctorsBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          const data = await Api.listDoctors({
            search: state.search,
            specialty: state.specialty,
            status: state.status,
            hospital: state.hospital,
            limit: 500,
          });
          Utils.downloadCsv(
            `doctor-app-doctors-${new Date().toISOString().slice(0, 10)}.csv`,
            data.items.map((doctor) => ({
              Name: doctor.name,
              Email: doctor.email,
              Phone: doctor.phone,
              Specialty: doctor.specialty,
              Qualification: doctor.qualification,
              Experience: doctor.experience_years,
              Hospital: doctor.hospital,
              City: doctor.city,
              Fee: doctor.consultation_fee,
              Rating: doctor.rating,
              Status: doctor.status,
            }))
          );
          toast('Export started.', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
      avatarInput.addEventListener('change', () => {
        const file = avatarInput.files?.[0];
        const preview = document.getElementById('avatarPreview');
        if (!file || !preview) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          preview.innerHTML = `<div class="avatar avatar-xl"><img src="${event.target.result}" alt="Preview"></div>`;
        };
        reader.readAsDataURL(file);
      });
    }

    loadFilters();
    loadDoctors();
  }

  return { init, loadDoctors };
})();

window.Doctors = Doctors;
document.addEventListener('DOMContentLoaded', Doctors.init);
