/* ==========================================================================
   Doctor Application – Patients page
   Patient directory (name, contact, city, age/gender/blood group).
   ========================================================================== */

const PatientsPage = (() => {
  let all = [];

  const $ = (s) => document.querySelector(s);

  function filtered() {
    const q = ($('#patientSearch').value || '').trim().toLowerCase();
    const gender = $('#genderFilter').value || 'all';
    return all.filter((p) => {
      const genderOk = gender === 'all' || String(p.gender || '') === gender;
      const text = `${p.name || ''} ${p.email || ''} ${p.phone || ''} ${p.city || ''}`.toLowerCase();
      return genderOk && (!q || text.includes(q));
    });
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
  }

  function row(p) {
    return `
      <tr>
        <td>
          <div class="cell-strong" style="display:flex;align-items:center;gap:.625rem;">
            <span class="avatar avatar-sm" style="background:color-mix(in oklab, var(--primary) 12%, transparent);color:var(--primary);">${Utils.escape(initials(p.name))}</span>
            ${Utils.escape(p.name || '—')}
          </div>
        </td>
        <td>
          <div>${Utils.escape(p.email || '—')}</div>
          <div class="text-xs text-muted">${Utils.escape(p.phone || '—')}</div>
        </td>
        <td>${Utils.escape(p.city || '—')}</td>
        <td class="cell-strong">${p.age != null ? Utils.escape(String(p.age)) : '—'}</td>
        <td>${Utils.escape(p.gender || '—')}</td>
        <td>${p.blood_group ? `<span class="badge badge-secondary">${Utils.escape(p.blood_group)}</span>` : '—'}</td>
      </tr>
    `;
  }

  function renderStats(rows) {
    const host = $('#patientStats');
    if (!host) return;
    const ages = rows.map((p) => Number(p.age)).filter((n) => Number.isFinite(n) && n > 0);
    const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;
    const males = rows.filter((p) => p.gender === 'Male').length;
    const females = rows.filter((p) => p.gender === 'Female').length;

    host.innerHTML = [
      { label: 'Total patients', value: Utils.number(rows.length), icon: 'users', accent: 'violet' },
      { label: 'Male', value: Utils.number(males), icon: 'user-round', accent: 'azure', pill: 'Male patients' },
      { label: 'Female', value: Utils.number(females), icon: 'user-round', accent: 'rose', pill: 'Female patients' },
      { label: 'Average age', value: avgAge == null ? '—' : `${avgAge} yrs`, icon: 'calendar-days', accent: 'amber', pill: rows.length ? 'All patients' : 'No data yet' },
    ]
      .map(
        (c) => `
      <div class="card stat-card" data-accent="${c.accent}">
        <div class="card-content">
          <div class="stat-top">
            <div>
              <div class="stat-label">${Utils.escape(c.label)}</div>
              <div class="stat-value">${c.value}</div>
            </div>
            <div class="stat-icon">${window.Icon(c.icon)}</div>
          </div>
          <div class="stat-foot">${c.pill ? `<span class="stat-pill"><span class="dot"></span>${Utils.escape(c.pill)}</span>` : ''}</div>
        </div>
      </div>`
      )
      .join('');
  }

  function render() {
    const rows = filtered();
    $('#patientTableBody').innerHTML = rows.map(row).join('');
    $('#patientsEmpty').classList.toggle('hidden', rows.length > 0);
    $('#resultsInfo').textContent = `${rows.length} of ${all.length} patients`;
  }

  async function init() {
    try {
      const data = await Api.get('/patients');
      all = Array.isArray(data) ? data : [];
      renderStats(all);
      render();
    } catch (err) {
      $('#resultsInfo').textContent = err.message || 'Could not load patients.';
      $('#patientsEmpty').classList.remove('hidden');
    }

    $('#patientSearch')?.addEventListener('input', () => render());
    $('#genderFilter')?.addEventListener('change', () => render());
  }

  return { init };
})();

window.PatientsPage = PatientsPage;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', PatientsPage.init)
  : PatientsPage.init();
