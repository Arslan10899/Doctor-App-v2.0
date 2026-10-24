/* ==========================================================================
   Doctor Application – Payments page
   Revenue records (amount, method, status, doctor) with quick totals.
   ========================================================================== */

const PaymentsPage = (() => {
  let all = [];

  const $ = (s) => document.querySelector(s);

  function filtered() {
    const q = ($('#paymentSearch').value || '').trim().toLowerCase();
    const status = $('#statusFilter').value || 'all';
    return all.filter((p) => {
      const statusOk = status === 'all' || String(p.status || '') === status;
      const text = `${p.doctor_name || ''} ${p.method || ''} ${p.notes || ''}`.toLowerCase();
      return statusOk && (!q || text.includes(q));
    });
  }

  function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    const tone = s === 'paid' ? 'up' : s === 'pending' ? 'warn' : s === 'refunded' ? 'down' : '';
    return `<span class="stat-pill ${tone}" style="font-size:.75rem;"><span class="dot"></span>${Utils.escape(status || '—')}</span>`;
  }

  function row(p) {
    return `
      <tr>
        <td>
          <div class="cell-strong">${Utils.escape(p.doctor_name || '—')}</div>
          <div class="text-xs text-muted">${Utils.escape(p.specialty || '')}</div>
        </td>
        <td class="cell-strong">${Utils.money(p.amount)}</td>
        <td>${Utils.escape(p.method || '—')}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${Utils.escape(String(p.paid_at || '—').replace('T', ' ').slice(0, 16))}</td>
        <td class="text-xs text-muted">${Utils.escape(p.notes || '—')}</td>
      </tr>
    `;
  }

  function renderStats(rows) {
    const host = $('#paymentStats');
    if (!host) return;
    const paid = rows.filter((p) => String(p.status).toLowerCase() === 'paid');
    const total = paid.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pending = rows.filter((p) => String(p.status).toLowerCase() === 'pending');
    const methods = {};
    rows.forEach((p) => {
      const m = p.method || 'Other';
      methods[m] = (methods[m] || 0) + 1;
    });
    const topMethod = Object.entries(methods).sort((a, b) => b[1] - a[1])[0];

    host.innerHTML = [
      { label: 'Collected (paid)', value: Utils.money(total, { compact: true }), icon: 'circle-dollar-sign', accent: 'green', pill: `${paid.length} paid`, pillTone: 'up' },
      { label: 'Payments', value: Utils.number(rows.length), icon: 'wallet', accent: 'azure', pill: 'All records' },
      { label: 'Pending', value: `${pending.length}`, icon: 'clock', accent: 'amber', pill: `${pending.length} awaiting`, pillTone: 'warn' },
      { label: 'Top method', value: topMethod ? Utils.escape(topMethod[0]) : '—', icon: 'credit-card', accent: 'violet', pill: topMethod ? `${topMethod[1]} payments` : 'No data yet' },
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
          <div class="stat-foot">${c.pill ? `<span class="stat-pill ${c.pillTone || ''}"><span class="dot"></span>${Utils.escape(c.pill)}</span>` : ''}</div>
        </div>
      </div>`
      )
      .join('');
  }

  function render() {
    const rows = filtered();
    $('#paymentTableBody').innerHTML = rows.map(row).join('');
    $('#paymentsEmpty').classList.toggle('hidden', rows.length > 0);
    $('#resultsInfo').textContent = `${rows.length} of ${all.length} payments`;
  }

  async function init() {
    try {
      const data = await Api.get('/payments');
      all = Array.isArray(data) ? data : [];
      renderStats(all);
      render();
    } catch (err) {
      $('#resultsInfo').textContent = err.message || 'Could not load payments.';
      $('#paymentsEmpty').classList.remove('hidden');
    }

    $('#paymentSearch')?.addEventListener('input', () => render());
    $('#statusFilter')?.addEventListener('change', () => render());
  }

  return { init };
})();

window.PaymentsPage = PaymentsPage;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', PaymentsPage.init)
  : PaymentsPage.init();
