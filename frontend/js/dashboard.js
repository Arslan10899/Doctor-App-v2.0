/* ==========================================================================
   Doctor Application – Dashboard page
   ========================================================================== */

const Dashboard = (() => {
  const state = {
    months: 12,
    stats: null,
  };

  /* ---------------------------------------------------------------------
   * Stat cards
   * ------------------------------------------------------------------- */
  function statCard({ label, value, icon, accent = 'neutral', pill, pillTone, foot, href }) {
    const iconChip = href
      ? `<a class="stat-icon-link" href="${href}" title="Open ${Utils.escape(label)}" aria-label="Open ${Utils.escape(label)}">
          <span class="stat-icon">${window.Icon(icon)}</span>
        </a>`
      : `<div class="stat-icon">${window.Icon(icon)}</div>`;

    return `<div class="card stat-card" data-accent="${accent}">
      <div class="card-content">
        <div class="stat-top">
          <div>
            <div class="stat-label">${Utils.escape(label)}</div>
            <div class="stat-value">${value}</div>
          </div>
          ${iconChip}
        </div>
        <div class="stat-foot">
          ${
            pill
              ? `<span class="stat-pill ${pillTone || ''}"><span class="dot"></span>${Utils.escape(pill)}</span>`
              : ''
          }
          ${foot ? `<span class="stat-foot-text">${Utils.escape(foot)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }

  function renderStats(stats) {
    const host = document.getElementById('statGrid');
    if (!host) return;

    const tablesIn = stats.storage?.tables || {};

    const cards = [
      statCard({
        label: 'Total Doctors',
        value: Utils.number(stats.total_doctors),
        icon: 'stethoscope',
        accent: 'azure',
        href: 'doctors.html?v=37',
        pill: `${Utils.number(stats.active_doctors)} active`,
        pillTone: 'up',
        foot: `~${formatBytes(tablesIn.doctors || 0)} in database · ${Utils.number(stats.total_cities)} cities`,
      }),
      statCard({
        label: 'Total Patients',
        value: Utils.number(stats.total_patients),
        icon: 'users',
        accent: 'violet',
        href: 'patients.html?v=37',
        pill: `${stats.avg_rating} avg rating`,
        foot: 'Registered in the clinic',
      }),
      statCard({
        label: "Today's Appointments",
        value: Utils.number(stats.today_appointments),
        icon: 'calendar-days',
        accent: 'green',
        href: 'appointments.html?v=37',
        pill: `${Utils.number(stats.completed_appointments)} completed`,
        pillTone: 'up',
        foot: `${Utils.number(stats.pending_appointments)} pending · ${Utils.number(stats.cancelled_appointments)} cancelled`,
      }),
      statCard({
        label: 'Total Revenue',
        value: Utils.money(stats.total_revenue, { compact: true }),
        icon: 'circle-dollar-sign',
        accent: 'neutral',
        href: 'payments.html?v=37',
        pill: `${Utils.number(stats.total_appointments)} appointments`,
        foot: stats.top_specialty ? `Top: ${stats.top_specialty}` : 'All time earnings',
      }),
      statCard({
        label: 'Hospitals',
        value: Utils.number(stats.total_hospitals),
        icon: 'building',
        accent: 'amber',
        href: 'hospitals.html?v=37',
        pill: 'Directory',
        foot: 'Imported from the backup',
      }),
      statCard({
        label: 'Duty Slots',
        value: Utils.number(stats.total_duty_slots),
        icon: 'calendar-check',
        accent: 'violet',
        href: 'appointments.html?v=37',
        pill: 'OPD / OT',
        foot: 'Hospital weekly schedule',
      }),
      statCard({
        label: 'App Users',
        value: Utils.number(stats.total_app_users),
        icon: 'smartphone',
        accent: 'azure',
        href: 'app-users.html?v=37',
        pill: `${Utils.number(stats.registered_app_users)} registered`,
        pillTone: 'up',
        foot: 'Rest are push tokens',
      }),
      statCard({
        label: 'Notifications',
        value: Utils.number(stats.total_notifications),
        icon: 'bell',
        accent: 'rose',
        href: 'notifications.html?v=37',
        pill: `${Utils.number(stats.total_backup_promos)} promos`,
        foot: 'Alerts on the mobile app',
      }),
    ];

    host.innerHTML = cards.join('');

    /* Clinic snapshot cards */
    const snap = {
      snapRevenue: Utils.money(stats.total_revenue, { compact: true }),
      snapRating: `${stats.avg_rating.toFixed(1)} / 5`,
      snapSpecialty: stats.top_specialty || '—',
      snapNew: Utils.number(stats.new_doctors_this_month),
    };
    Object.entries(snap).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    });
  }

  /* ---------------------------------------------------------------------
   * Charts
   * ------------------------------------------------------------------- */
  function renderAppointmentsChart(rows) {
    const host = document.getElementById('appointmentsChart');
    if (!host) return;

    Charts.area(host, {
      labels: rows.map((row) => row.month),
      series: [
        {
          name: 'Appointments',
          data: rows.map((row) => row.total),
          color: 'var(--chart-1)',
          type: 'area',
        },
        {
          name: 'Completed',
          data: rows.map((row) => row.completed),
          color: 'var(--chart-2)',
          type: 'line',
        },
      ],
      formatValue: (value) => `${Utils.number(value)} appointments`,
    });

    const legend = document.getElementById('chartLegend');
    if (legend) {
      legend.innerHTML = `
        <span><i class="legend-dot" style="background:var(--chart-1)"></i> Appointments</span>
        <span><i class="legend-dot" style="background:var(--chart-2)"></i> Completed</span>
        <span><i class="legend-dot" style="background:var(--chart-3)"></i> Scheduled</span>
        <span><i class="legend-dot" style="background:var(--chart-4)"></i> Pending</span>`;
    }
  }

  function renderStatusChart(stats) {
    const host = document.getElementById('statusChart');
    if (!host) return;

    const labels = ['Completed', 'Scheduled', 'Pending', 'Cancelled'];
    const data = [
      stats.completed_appointments,
      stats.scheduled_appointments,
      stats.pending_appointments,
      stats.cancelled_appointments,
    ];
    const colors = ['var(--success)', 'var(--chart-2)', 'var(--warning)', 'var(--destructive)'];

    Charts.doughnut(host, { labels, data, colors });

    const legend = document.getElementById('statusLegend');
    if (legend) {
      const total = data.reduce((sum, value) => sum + value, 0) || 1;
      legend.innerHTML = labels
        .map(
          (label, index) => `
          <div class="bar-row" style="grid-template-columns: 6rem 1fr 3.25rem;">
            <span class="bar-label">${label}</span>
            <span class="bar-track">
              <span class="bar-fill" style="width:${((data[index] / total) * 100).toFixed(1)}%;background:${colors[index]}"></span>
            </span>
            <span class="bar-value">${Utils.number(data[index])}</span>
          </div>`
        )
        .join('');
    }
  }

  function renderSpecialtyChart(rows) {
    const host = document.getElementById('specialtyChart');
    if (!host) return;

    const top = rows.slice(0, 7);
    const max = Math.max(...top.map((row) => row.appointments), 1);
    const colors = [
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)',
      'var(--chart-5)',
      'var(--chart-1)',
      'var(--chart-2)',
    ];

    host.innerHTML = top
      .map(
        (row, index) => `
        <div class="bar-row">
          <span class="bar-label" title="${Utils.escape(row.specialty)}">${Utils.escape(row.specialty)}</span>
          <span class="bar-track">
            <span class="bar-fill" style="width:${((row.appointments / max) * 100).toFixed(1)}%;background:${
          colors[index % colors.length]
        }"></span>
          </span>
          <span class="bar-value">${Utils.number(row.appointments)}</span>
        </div>`
      )
      .join('');
  }

  /* ---------------------------------------------------------------------
   * Recent appointments table
   * ------------------------------------------------------------------- */
  function renderRecentAppointments(rows) {
    const host = document.getElementById('recentAppointments');
    if (!host) return;

    if (!rows.length) {
      host.innerHTML = `<div class="empty-state">
        ${window.Icon('inbox')}
        <strong>No appointments yet</strong>
        <span>New bookings will appear here.</span>
      </div>`;
      return;
    }

    host.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Date</th>
              <th>Fee</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
              <tr>
                <td>
                  <div class="flex items-center gap-2">
                    ${Utils.avatar({ name: row.patient_name || 'Patient' }, 'avatar-sm')}
                    <div>
                      <div class="cell-strong">${Utils.escape(row.patient_name || 'Unknown')}</div>
                      <div class="cell-muted text-xs">${Utils.escape(row.reason || 'Consultation')}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="cell-strong">${Utils.escape(row.doctor_name || '—')}</div>
                  <div class="cell-muted text-xs">${Utils.escape(row.specialty || '')}</div>
                </td>
                <td>
                  <div class="cell-strong">${Utils.formatDate(row.appointment_date)}</div>
                  <div class="cell-muted text-xs">${Utils.escape(row.time_slot || '')}</div>
                </td>
                <td class="cell-strong">${Utils.money(row.fee)}</td>
                <td>${Utils.statusBadge(row.status)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ---------------------------------------------------------------------
   * Top doctors
   * ------------------------------------------------------------------- */
  function renderTopDoctors(rows) {
    const host = document.getElementById('topDoctors');
    if (!host) return;

    if (!rows.length) {
      host.innerHTML = `<div class="empty-state">${window.Icon('stethoscope')}<strong>No doctors yet</strong></div>`;
      return;
    }

    host.innerHTML = rows
      .map(
        (row) => `
        <div class="list-row">
          ${Utils.avatar(row, 'avatar-sm')}
          <div class="list-row-meta">
            <strong>${Utils.escape(row.name)}</strong>
            <span>${Utils.escape(row.specialty)} · ${Utils.number(row.appointments)} appointments</span>
          </div>
          <div style="text-align:right;">
            ${Utils.stars(row.rating)}
            <div class="text-xs text-muted">${Utils.money(row.revenue, { compact: true })}</div>
          </div>
        </div>`
      )
      .join('');
  }

  /* ---------------------------------------------------------------------
   * Storage & data usage card
   * ------------------------------------------------------------------- */
  function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${b} B`;
  }

  function renderStorage(stats) {
    const s = stats.storage || {};
    const db = document.getElementById('storageDb');
    if (!db) return;

    const badge = (label, value) => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.4rem .625rem;border:1px solid var(--border);border-radius:var(--radius-md);">
        <span class="text-sm">${label}</span>
        <span class="cell-strong">${value}</span>
      </div>`;

    db.textContent = formatBytes(s.db_bytes);
    document.getElementById('storageDbFile').textContent = `${s.db_file || 'doctor_app.db'} (SQLite)`;
    const uploadsEl = document.getElementById('storageUploads');
    if (uploadsEl) uploadsEl.textContent = formatBytes(s.uploads_bytes);
    document.getElementById('storageUploadsFiles').textContent = `${Utils.number(s.uploads_files)} file${s.uploads_files === 1 ? '' : 's'} on disk`;
    const sumEl = document.getElementById('storageSum');
    if (sumEl) sumEl.textContent = formatBytes(s.total_bytes);
    const badgeEl = document.getElementById('storageTotalBadge');
    if (badgeEl) badgeEl.textContent = `${formatBytes(s.total_bytes)} on disk`;

    const host = document.getElementById('storageLines');
    if (!host) return;
    const t = s.tables || {};
    const rows = [
      [`Doctors`, `${Utils.number(stats.total_doctors)} records · ~${formatBytes(t.doctors || 0)} in DB`],
      [`Hospitals`, `${Utils.number(stats.total_hospitals)} in ${Utils.number(stats.total_cities)} cities · ~${formatBytes(t.hospitals || 0)}`],
      [`Duty slots`, `${Utils.number(stats.total_duty_slots)} · ~${formatBytes(t.hospital_schedules || 0)}`],
      [`App users`, `${Utils.number(stats.total_app_users)} (${Utils.number(stats.registered_app_users)} registered) · ~${formatBytes(t.app_users || 0)}`],
      [`Notifications`, `${Utils.number(stats.total_notifications)} (${Utils.number(stats.total_backup_promos)} backup promos) · ~${formatBytes(t.notifications || 0)}`],
      [`My Ads`, `${Utils.number(stats.total_my_ads)} (${Utils.number(stats.active_my_ads)} active) · ~${formatBytes(t.my_ads || 0)}`],
    ];
    host.innerHTML = rows
      .map(([label, value]) => badge(label, value))
      .join('') + `
      <div class="text-xs text-muted" style="padding:0 .25rem;">
        Table sizes are estimates (column payload + row overhead) — the full database file is ${formatBytes(s.db_bytes)}.
      </div>`;
  }
  /* ---------------------------------------------------------------------
   * Loader
   * ------------------------------------------------------------------- */
  function showError(message) {
    const host = document.getElementById('pageError');
    if (!host) return;
    host.innerHTML = `<div class="card"><div class="card-content">
      <div class="empty-state">
        ${window.Icon('x-circle')}
        <strong>Could not load the dashboard</strong>
        <span>${Utils.escape(message)}</span>
        <button class="btn btn-outline btn-sm" onclick="location.reload()">Retry</button>
      </div>
    </div></div>`;
    host.classList.remove('hidden');
  }

  async function load() {
    const errorHost = document.getElementById('pageError');
    if (errorHost) errorHost.classList.add('hidden');

    try {
      const [stats, appointments, specialties, recent, top] = await Promise.all([
        Api.dashboardStats(),
        Api.chartAppointments(state.months),
        Api.chartSpecialties(),
        Api.recentAppointments(7),
        Api.topDoctors(5),
      ]);

      state.stats = stats;
      renderStats(stats);
      renderStorage(stats);
      renderAppointmentsChart(appointments);
      renderStatusChart(stats);
      renderSpecialtyChart(specialties);
      renderRecentAppointments(recent);
      renderTopDoctors(top);

      const updated = document.getElementById('lastUpdated');
      if (updated) updated.textContent = `Updated ${new Date().toLocaleTimeString('en-GB')}`;
    } catch (err) {
      showError(err.message);
      toast(err.message, 'error');
    }
  }

  /* ---------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------- */
  function init() {
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) {
      const user = Api.getUser() || {};
      const name = (user.name || 'Doctor').split(' ')[0];
      const hour = new Date().getHours();
      const iconName = hour >= 5 && hour < 19 ? 'sun' : 'moon';
      greetingEl.innerHTML = `${Utils.greeting()}, ${Utils.escape(name)} ${window.Icon(iconName)}`;
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.querySelector('.icon')?.classList.add('spin');
        await load();
        refreshBtn.disabled = false;
        refreshBtn.querySelector('.icon')?.classList.remove('spin');
        toast('Dashboard refreshed.', 'success');
      });
    }

    const rangeSelect = document.getElementById('rangeSelect');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', async () => {
        state.months = Number(rangeSelect.value);
        try {
          const rows = await Api.chartAppointments(state.months);
          renderAppointmentsChart(rows);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          const rows = await Api.chartAppointments(state.months);
          Utils.downloadCsv(
            `doctor-app-appointments-${new Date().toISOString().slice(0, 10)}.csv`,
            rows
          );
          toast('Export started.', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }

    load();
  }

  return { init, load };
})();

window.Dashboard = Dashboard;
document.addEventListener('DOMContentLoaded', Dashboard.init);
