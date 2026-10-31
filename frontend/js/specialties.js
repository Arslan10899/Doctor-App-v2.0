/* ==========================================================================
   Doctor Application – Specialties page
   Two views from the backup:
     1. departments (the specialties collection) with live doctor counts
     2. opd-specialties – exactly how the mobile app groups doctors (EN+UR)
   ========================================================================== */

const Specialties = (() => {
  let departments = [];
  let opd = [];
  let deptSearch = '';
  let opdSearch = '';

  const $ = (s) => document.querySelector(s);

  function deptRow(d) {
    const link = `doctors.html?v=46&specialty=${encodeURIComponent(d.name)}`;
    return `
      <tr>
        <td>
          <div class="cell-strong">${Utils.escape(d.name)}</div>
          ${d.description ? `<div class="cell-muted text-xs">${Utils.escape(d.description)}</div>` : ''}
        </td>
        <td><span class="sp-count">${Utils.number(d.doctors)} doctor${d.doctors === 1 ? '' : 's'}</span></td>
        <td><a class="link-cell" href="${link}">Show doctors →</a></td>
      </tr>
    `;
  }

  function opdCard(sp) {
    return `
      <div class="opd-card">
        <div class="opd-en">${Utils.escape(sp.name_en || '—')}</div>
        ${sp.name_ur ? `<div class="opd-ur">${Utils.escape(sp.name_ur)}</div>` : ''}
      </div>
    `;
  }

  function renderDepts() {
    const q = deptSearch.trim().toLowerCase();
    const rows = departments.filter((d) => !q || (d.name || '').toLowerCase().includes(q));
    $('#deptTableBody').innerHTML = rows.map(deptRow).join('');
    $('#deptInfo').textContent = `${rows.length} of ${departments.length} departments`;
  }

  function renderOpd() {
    const q = opdSearch.trim().toLowerCase();
    const rows = opd.filter(
      (sp) => !q || `${sp.name_en || ''} ${sp.name_ur || ''}`.toLowerCase().includes(q)
    );
    $('#opdGrid').innerHTML = rows.map(opdCard).join('');
    $('#opdEmpty').classList.toggle('hidden', rows.length > 0);
    $('#opdInfo').textContent = `${rows.length} of ${opd.length} groups`;
  }

  function render() {
    renderDepts();
    renderOpd();
  }

  async function init() {
    try {
      const [deptList, opdList] = await Promise.all([
        Api.specialties(),
        Api.opdSpecialties().catch(() => []),
      ]);
      departments = deptList || [];
      opd = opdList || [];
      render();
    } catch (err) {
      $('#deptInfo').textContent = err.message || 'Could not load specialties.';
    }

    const bindSearch = (id, setter) => {
      const box = $(id);
      if (!box) return;
      box.addEventListener(
        'input',
        Utils.debounce(() => {
          setter(box.value);
          render();
        }, 250)
      );
    };

    bindSearch('#deptSearch', (v) => (deptSearch = v));
    bindSearch('#opdSearch', (v) => (opdSearch = v));
  }

  return { init };
})();

window.Specialties = Specialties;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', Specialties.init)
  : Specialties.init();
