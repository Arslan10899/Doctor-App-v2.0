/* ==========================================================================
   Doctor Application – Hospitals page
   Hospital directory imported from the local backup (name, city, linked
   doctors and OPD/OT duty-slot counts).
   ========================================================================== */

const Hospitals = (() => {
  let all = [];
  let cities = [];
  let activeCity = 'all';

  const $ = (s) => document.querySelector(s);

  function icon(name) {
    return window.Icon ? window.Icon(name) : '';
  }

  /* ------------------------- Add hospital modal ------------------------- */
  function fillCityDatalist() {
    const list = $('#fhCityList');
    if (!list) return;
    list.innerHTML = cities
      .map((c) => `<option value="${Utils.escape(c.name)}"></option>`)
      .join('');
  }

  function openHospitalModal() {
    const modal = $('#hospitalModal');
    if (!modal) return;
    $('#hospitalForm')?.reset();
    fillCityDatalist();
    modal.classList.add('open');
    $('#fh-name')?.focus();
  }

  function closeHospitalModal() {
    $('#hospitalModal')?.classList.remove('open');
  }

  function wireHospitalModal() {
    $('#addHospitalBtn')?.addEventListener('click', openHospitalModal);
    $('#closeHospitalModalBtn')?.addEventListener('click', closeHospitalModal);
    $('#cancelHospitalModalBtn')?.addEventListener('click', closeHospitalModal);

    /* click on the dimmed backdrop closes the dialog */
    $('#hospitalModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeHospitalModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#hospitalModal')?.classList.contains('open')) {
        closeHospitalModal();
      }
    });

    $('#hospitalForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const els = form.elements;
      const submit = $('#hospitalModalSubmit');
      const payload = {
        name: els.name.value.trim(),
        urdu_name: els.urdu_name.value.trim() || null,
        city: els.city.value.trim() || null,
      };
      if (!payload.name || payload.name.length < 2) return;

      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = 'Saving…';
      try {
        const created = await Api.post('/hospitals', payload);
        closeHospitalModal();
        window.toast?.(`Hospital "${created.name}" added.`, 'success');
        /* refresh list + city strip so the new hospital shows right away */
        const [directory, cityList] = await Promise.all([
          Api.get('/hospitals/directory'),
          Api.get('/cities'),
        ]);
        all = directory || [];
        cities = cityList || [];
        activeCity = payload.city || 'all';
        renderCities();
        render();
      } catch (err) {
        window.toast?.(err.message || 'Could not add hospital.', 'error');
      } finally {
        submit.disabled = false;
        submit.textContent = original;
      }
    });
  }

  function renderCities() {
    const strip = $('#citiesStrip');
    if (!strip) return;

    const chips = [`<button type="button" class="hosp-city-chip ${activeCity === 'all' ? 'is-active' : ''}" data-city="all">
        ${icon('map-pin')} All cities
      </button>`];

    cities.forEach((c) => {
      chips.push(`\n<button type="button" class="hosp-city-chip ${activeCity === c.name ? 'is-active' : ''}" data-city="${Utils.escape(c.name)}">
        <strong>${Utils.escape(c.name)}</strong>
        <span>${c.hospitals} hosp · ${c.doctors} doc</span>
      </button>`);
    });

    strip.innerHTML = chips.join('');

    strip.querySelectorAll('[data-city]').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeCity = chip.dataset.city;
        render();
      });
    });
  }

  function filtered() {
    const q = ($('#hospitalSearch').value || '').trim().toLowerCase();
    return all.filter((h) => {
      const cityOk = activeCity === 'all' || h.city === activeCity;
      const text = `${h.name} ${h.urdu_name || ''} ${h.city || ''}`.toLowerCase();
      return cityOk && (!q || text.includes(q));
    });
  }

  function card(h) {
    /* Every card (and each metric inside it) now opens the hospital's own
       profile page – #doctors / #slots anchors scroll straight to the section. */
    const profile = `hospital-profile.html?v=41&id=${encodeURIComponent(h.id)}`;
    const specialties = Array.isArray(h.specialties) ? h.specialties.slice(0, 3) : [];
    const moreSpecialties = (h.specialties || []).length - specialties.length;

    return `
      <article class="hosp-card" data-id="${h.id}" tabindex="0" role="link"
               data-href="${profile}" aria-label="Open hospital ${Utils.escape(h.name || '')}">
        <div class="hosp-card-cover">
          <div class="hosp-card-cover-fallback" aria-hidden="true"></div>
          ${h.cover_image_url ? `<img class="hosp-card-cover-img" src="${h.cover_image_url}" alt="" loading="lazy" />` : ''}
        </div>
        <div class="hosp-card-top">
          <div class="hosp-tile">${h.profile_image_url ? `<img class="hosp-card-logo" src="${h.profile_image_url}" alt="" loading="lazy" />` : icon('building')}</div>
          <div class="hosp-card-head">
            <div class="hosp-name">${Utils.escape(h.name || '—')}</div>
            ${h.urdu_name ? `<div class="hosp-name-urdu">${Utils.escape(h.urdu_name)}</div>` : ''}
          </div>
          <span class="hosp-city-badge">${icon('map-pin')} ${Utils.escape(h.city || '—')}</span>
        </div>

        <hr class="hosp-divider" />

        <div class="hosp-metrics">
          <a class="hosp-metric" href="${profile}#doctors" title="Doctors at this hospital">
            ${icon('users')}
            <span class="hosp-metric-text">
              <span class="hosp-metric-value">${Utils.number(h.doctor_count)}</span>
              <span class="hosp-metric-label" style="display:block;">Doctor${h.doctor_count === 1 ? '' : 's'} at hospital</span>
            </span>
          </a>
          <a class="hosp-metric ${h.schedules ? '' : 'is-empty'}" href="${profile}#slots"
             title="${h.schedules ? 'OPD/OT duty slots' : 'No duty slots imported'}">
            ${icon('clock')}
            <span class="hosp-metric-text">
              <span class="hosp-metric-value">${Utils.number(h.schedules)}</span>
              <span class="hosp-metric-label" style="display:block;">OPD/OT duty slot${h.schedules === 1 ? '' : 's'}</span>
            </span>
          </a>
        </div>

        ${specialties.length
          ? `<div class="hosp-specialties">
               <span class="text-xs text-muted" style="flex:none;">Specialties:</span>
               ${specialties
                 .map((s) => `<span class="hosp-spec-chip"><span>${Utils.escape(s)}</span></span>`)
                 .join('')}
               ${moreSpecialties > 0 ? `<span class="text-xs text-muted">+${moreSpecialties} more</span>` : ''}
             </div>`
          : ''}

        <div class="hosp-foot">
          <span class="hosp-view">View hospital ${icon('arrow-right')}</span>
          <span class="hosp-foot-note">${h.origin === 'panel' ? 'Added from panel' : 'From the backup'}</span>
        </div>
      </article>
    `;
  }

  function bindCardNavigation(grid) {
    /* Whole card opens the hospital profile; inner metric links take over
       and scroll the profile to the doctors / duty-slots section. */
    grid.querySelectorAll('.hosp-card').forEach((cardEl) => {
      const open = () => {
        if (cardEl.dataset.href) window.location.href = cardEl.dataset.href;
      };
      cardEl.addEventListener('click', (event) => {
        if (event.target.closest('a')) return; /* let the <a> handle it */
        open();
      });
      cardEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function render() {
    const grid = $('#hospitalsGrid');
    const empty = $('#hospitalsEmpty');
    const rows = filtered();

    grid.innerHTML = rows.map(card).join('');
    bindCardNavigation(grid);
    empty.classList.toggle('hidden', rows.length > 0);

    $('#resultsInfo').textContent = `${rows.length} of ${all.length} hospitals`;
  }

  async function init() {
    try {
      const [directory, cityList] = await Promise.all([
        Api.get('/hospitals/directory'),
        Api.get('/cities'),
      ]);
      all = directory || [];
      cities = cityList || [];
      renderCities();
      render();
    } catch (err) {
      $('#resultsInfo').textContent = err.message || 'Could not load hospitals.';
    }

    $('#hospitalSearch')?.addEventListener('input', () => render());
    $('#cityFilter')?.addEventListener('change', (e) => {
      activeCity = e.target.value;
      render();
    });

    wireHospitalModal();
  }

  return { init };
})();

window.Hospitals = Hospitals;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', Hospitals.init)
  : Hospitals.init();
