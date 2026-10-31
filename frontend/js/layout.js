/* ==========================================================================
   Doctor Application – app shell (header + sidebar)
   --------------------------------------------------------------------------
   The shell mirrors the ui.shadcn.com layout: a full width sticky header
   with the brand, the primary navigation, the search field and the account
   actions, plus a sticky sidebar column that lives inside the content area.
   ========================================================================== */

const NAV_SECTIONS = [
  {
    heading: 'Dashboard',
    items: [
      { label: 'Overview', icon: 'layout-dashboard', href: 'index.html?v=35' },
      { label: 'Analytics', icon: 'bar-chart-3', module: 'Analytics' },
    ],
  },
  {
    heading: 'Management',
    items: [
      { label: 'Doctors', icon: 'stethoscope', href: 'doctors.html?v=35', badge: 'doctors' },
      { label: 'Hospitals', icon: 'building', href: 'hospitals.html?v=35', badge: 'hospitals' },
      { label: 'Appointments', icon: 'calendar-days', href: 'appointments.html?v=35', badge: 'duty_slots' },
      { label: 'Patients', icon: 'users', href: 'patients.html?v=35', badge: 'patients' },
      { label: 'Payments', icon: 'wallet', href: 'payments.html?v=35' },
    ],
  },
  {
    heading: 'Mobile App',
    items: [
      { label: 'App Users', icon: 'smartphone', href: 'app-users.html?v=35', badge: 'app_users' },
      { label: 'Notifications', icon: 'bell', href: 'notifications.html?v=35', badge: 'notifications' },
      { label: 'My Ads', icon: 'megaphone', href: 'my-ads.html?v=35', badge: 'my_ads' },
    ],
  },
  {
    heading: 'Clinic',
    items: [
      { label: 'Specialties', icon: 'sparkles', href: 'specialties.html?v=35' },
      { label: 'Departments', icon: 'building-2', module: 'Departments' },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Settings', icon: 'settings', href: 'account.html?v=35' },
      { label: 'Help Center', icon: 'help-circle', module: 'Help Center' },
    ],
  },
];

/* Primary navigation shown in the header (desktop). */
const HEADER_NAV = [
  { label: 'Overview', href: 'index.html?v=35' },
  { label: 'Doctors', href: 'doctors.html?v=35' },
  { label: 'Patients', href: 'patients.html?v=35' },
  { label: 'Appointments', href: 'appointments.html?v=35' },
  { label: 'Payments', href: 'payments.html?v=35' },
  { label: 'Analytics', module: 'Analytics' },
];

const Layout = (() => {
  const COLLAPSE_KEY = 'doctor_app_sidebar_collapsed';

  /* ---------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------- */
  function currentPage() {
    const file = window.location.pathname.split('/').pop();
    return file || 'index.html';
  }

  function isActive(href) {
    if (!href) return false;
    /* Versioned links (doctors.html?v=35) share the pathname with plain ones. */
    return currentPage() === String(href).split('?')[0];
  }

  function user() {
    return (
      Api.getUser() || {
        name: 'Admin',
        email: 'admin@doctorapp.com',
        role: 'Administrator',
        avatar_url: null,
      }
    );
  }

  function isDesktop() {
    return window.innerWidth >= 1024;
  }

  /* ---------------------------------------------------------------------
   * Sidebar
   * ------------------------------------------------------------------- */
  function renderSidebar() {
    const host = document.getElementById('sidebar');
    if (!host) return;

    const nav = NAV_SECTIONS.map((section) => {
      const items = section.items
        .map((item) => {
          const active = isActive(item.href);
          const badge = item.badge
            ? `<span class="nav-badge" data-badge="${item.badge}">–</span>`
            : '';
          if (item.href) {
            return `<a class="nav-item${active ? ' is-active' : ''}" href="${item.href}" ${
              active ? 'aria-current="page"' : ''
            }>
              ${window.Icon(item.icon)}
              <span class="nav-label">${Utils.escape(item.label)}</span>
              ${badge}
            </a>`;
          }
          return `<button type="button" class="nav-item" data-module="${Utils.escape(item.label)}">
            ${window.Icon(item.icon)}
            <span class="nav-label">${Utils.escape(item.label)}</span>
            ${badge}
          </button>`;
        })
        .join('');

      return `<div class="nav-group">
        <div class="nav-heading">${Utils.escape(section.heading)}</div>
        ${items}
      </div>`;
    }).join('');

    host.innerHTML = `
      <button type="button" class="sidebar-close" id="sidebarClose" aria-label="Close menu">
        ${window.Icon('x-circle')}
      </button>

      <div class="sidebar-scroll">
        <nav class="sidebar-nav" aria-label="Main navigation">${nav}</nav>
      </div>

      <div class="sidebar-foot">
        <button type="button" class="sidebar-collapse-btn" id="sidebarCollapse" aria-expanded="true" aria-label="Collapse sidebar">
          ${window.Icon('chevrons-left', 'sidebar-collapse-icon')}
          <span class="sidebar-collapse-label">Collapse</span>
        </button>
      </div>
    `;

    host.querySelectorAll('[data-module]').forEach((button) => {
      button.addEventListener('click', () => {
        toast(`“${button.dataset.module}” module is coming soon.`, 'info');
      });
    });

    const collapseBtn = host.querySelector('#sidebarCollapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => toggleCollapsed());
    }

    const closeBtn = host.querySelector('#sidebarClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    }
  }

  /* ---------------------------------------------------------------------
   * Header
   * ------------------------------------------------------------------- */
  function renderHeader() {
    const host = document.getElementById('topbar');
    if (!host) return;

    const profile = user();

    const nav = HEADER_NAV.map((item) => {
      const active = isActive(item.href);
      if (item.href) {
        return `<a class="header-nav-link${active ? ' is-active' : ''}" href="${item.href}" ${
          active ? 'aria-current="page"' : ''
        }>${Utils.escape(item.label)}</a>`;
      }
      return `<button type="button" class="header-nav-link" data-module="${Utils.escape(item.label)}">${Utils.escape(
        item.label
      )}</button>`;
    }).join('');

    host.innerHTML = `
      <div class="site-header-inner">
        <button type="button" class="menu-trigger" id="sidebarToggle" aria-label="Toggle menu">
          <span class="menu-bars"><span></span><span></span></span>
          <span>Menu</span>
        </button>

        <a class="header-brand" href="index.html?v=35">
          <img class="brand-mark" src="assets/app-icon-64.png?v=18" alt="Doctor App" />
          <span class="header-brand-name">Doctor App</span>
        </a>

        <nav class="header-nav" aria-label="Primary">${nav}</nav>

        <div class="header-actions">
          <div class="header-search">
            ${window.Icon('search')}
            <input type="search" id="globalSearch" placeholder="Search doctors, patients…" aria-label="Global search" />
            <kbd>⌘K</kbd>
          </div>

          <span class="header-sep"></span>

          <a class="header-icon-btn" href="https://github.com/shadcndashboard/shadcndashboard" target="_blank" rel="noopener" aria-label="Design reference">
            ${window.Icon('github')}
          </a>

          <span class="header-sep"></span>

          <button type="button" class="header-icon-btn" id="themeToggle" aria-label="Toggle theme"></button>

          <div class="dropdown" id="notificationsDropdown">
            <button type="button" class="header-icon-btn" data-dropdown-toggle aria-label="Notifications">
              ${window.Icon('bell')}
            </button>
            <div class="dropdown-menu" style="min-width: 20rem;">
              <div class="dropdown-label">Notifications</div>
              <div id="notificationList">
                <div class="dropdown-item text-muted">Loading…</div>
              </div>
            </div>
          </div>

          <div class="dropdown" id="profileDropdown">
            <button type="button" class="header-avatar" data-dropdown-toggle aria-label="Account menu">
              ${Utils.avatar(profile, 'avatar-sm')}
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-label">${Utils.escape(profile.email || '')}</div>
              <a class="dropdown-item" href="account.html?v=35">${window.Icon('user-round')} Profile</a>
              <a class="dropdown-item" href="account.html?v=35">${window.Icon('settings')} Settings</a>
              <div class="dropdown-separator"></div>
              <button type="button" class="dropdown-item" id="signOutBtn">${window.Icon('log-out')} Sign out</button>
            </div>
          </div>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-module]').forEach((button) => {
      button.addEventListener('click', () => {
        toast(`“${button.dataset.module}” section is coming soon.`, 'info');
      });
    });

    const signOut = document.getElementById('signOutBtn');
    if (signOut) {
      signOut.addEventListener('click', () => {
        Api.setToken('');
        Api.setUser(null);
        toast('Signed out.', 'info');
        setTimeout(() => {
          window.location.replace('login.html?v=35');
        }, 400);
      });
    }

    /* The theme toggle lives in the header, so wire it up after rendering. */
    if (window.Theme) {
      window.Theme.syncButton();
      window.Theme.bindToggle();
    }
  }

  /* ---------------------------------------------------------------------
   * Behaviour
   * ------------------------------------------------------------------- */
  function syncCollapseButton() {
    const btn = document.getElementById('sidebarCollapse');
    if (!btn) return;
    const collapsed = document.body.classList.contains('sidebar-collapsed');
    btn.innerHTML = `${window.Icon(collapsed ? 'chevrons-right' : 'chevrons-left', 'sidebar-collapse-icon')}
      <span class="sidebar-collapse-label">${collapsed ? 'Expand' : 'Collapse'}</span>`;
    btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-expanded', String(!collapsed));
  }

  function toggleCollapsed() {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch (err) {
      /* ignore */
    }
    syncCollapseButton();
  }

  function bindSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggle) {
      toggle.addEventListener('click', () => {
        if (isDesktop()) {
          toggleCollapsed();
          return;
        }
        document.body.classList.toggle('sidebar-open');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    }

    /* Collapse state only makes sense on the desktop layout. */
    window.addEventListener('resize', () => {
      if (isDesktop()) document.body.classList.remove('sidebar-open');
    });
  }

  function bindDropdowns() {
    document.addEventListener('click', (event) => {
      const toggler = event.target.closest('[data-dropdown-toggle]');
      document.querySelectorAll('.dropdown.open').forEach((dropdown) => {
        if (!dropdown.contains(toggler)) dropdown.classList.remove('open');
      });
      if (toggler) {
        const dropdown = toggler.closest('.dropdown');
        if (dropdown) dropdown.classList.toggle('open');
        event.stopPropagation();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.dropdown.open').forEach((d) => d.classList.remove('open'));
        document.body.classList.remove('sidebar-open');
      }
    });
  }

  function bindSearch() {
    const input = document.getElementById('globalSearch');
    if (!input) return;

    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const term = input.value.trim();
      if (!term) return;
      window.location.href = `doctors.html?v=35&search=${encodeURIComponent(term)}`;
    });

    /* ⌘K / Ctrl+K focuses the search field, like on ui.shadcn.com. */
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /* ---------------------------------------------------------------------
   * Badge counters (pulled from the live API)
   * ------------------------------------------------------------------- */
  async function loadBadges() {
    try {
      const stats = await Api.dashboardStats();
      const map = {
        doctors: stats.total_doctors,
        hospitals: stats.total_hospitals,
        patients: stats.total_patients,
        duty_slots: stats.total_duty_slots,
        app_users: stats.total_app_users,
        notifications: stats.total_notifications,
        my_ads: stats.total_my_ads,
      };
      document.querySelectorAll('[data-badge]').forEach((el) => {
        const value = map[el.dataset.badge];
        if (value !== undefined) el.textContent = Utils.number(value);
      });
    } catch (err) {
      /* the dashboard renders the real error state */
    }
  }

  async function loadNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    try {
      const [recent, stats] = await Promise.all([Api.recentAppointments(4), Api.dashboardStats()]);
      const items = [];

      if (stats.today_appointments) {
        items.push({
          icon: 'calendar-days',
          text: `${stats.today_appointments} appointment(s) scheduled today`,
        });
      }
      if (stats.pending_appointments) {
        items.push({
          icon: 'clock',
          text: `${stats.pending_appointments} appointment(s) awaiting confirmation`,
        });
      }
      if (stats.new_doctors_this_month) {
        items.push({
          icon: 'user-plus',
          text: `${stats.new_doctors_this_month} new doctor(s) joined this month`,
        });
      }
      recent.slice(0, 2).forEach((appt) => {
        items.push({
          icon: 'inbox',
          text: `${appt.patient_name || 'Patient'} · ${appt.doctor_name || 'Doctor'} (${appt.status})`,
        });
      });

      list.innerHTML = items.length
        ? items
            .map(
              (item) =>
                `<div class="dropdown-item" style="cursor:default;align-items:flex-start;">
                  <span style="color:var(--muted-foreground);margin-top:.125rem;">${window.Icon(item.icon)}</span>
                  <span>${Utils.escape(item.text)}</span>
                </div>`
            )
            .join('')
        : '<div class="dropdown-item text-muted">Nothing new right now.</div>';
    } catch (err) {
      list.innerHTML = '<div class="dropdown-item text-muted">Unable to load notifications.</div>';
    }
  }

  /* ---------------------------------------------------------------------
   * Auth gate – every page (except login) needs a valid session
   * ------------------------------------------------------------------- */
  async function requireAuth() {
    if (!Api.getToken()) {
      window.location.replace('login.html?v=35');
      return false;
    }
    try {
      const me = await Api.me();
      Api.setUser(me);
      return true;
    } catch (err) {
      Api.setToken('');
      Api.setUser(null);
      window.location.replace('login.html?v=35');
      return false;
    }
  }

  /* ---------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------- */
  async function init() {
    if (!(await requireAuth())) return;

    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1' && isDesktop()) {
        document.body.classList.add('sidebar-collapsed');
      }
    } catch (err) {
      /* ignore */
    }

    renderSidebar();
    renderHeader();
    syncCollapseButton();
    bindSidebarToggle();
    bindDropdowns();
    bindSearch();
    loadBadges();
    loadNotifications();
  }

  return { init, renderSidebar, renderHeader };
})();

window.Layout = Layout;
document.addEventListener('DOMContentLoaded', Layout.init);
