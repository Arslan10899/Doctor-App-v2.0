/* ==========================================================================
   Doctor Application – Project roadmap page
   Static roadmap data rendered as a professional timeline.
   Add new updates at the TOP of each status list.
   ========================================================================== */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const icon = (name) => (window.Icon ? window.Icon(name) : '');

  /** Status definitions drive the groups, chips and icons. */
  const GROUPS = [
    {
      id: 'done',
      title: 'Shipped – milestones completed',
      chip: 'Shipped',
      date: 'Oct 2026',
      icon: 'check-circle',
    },
    {
      id: 'next',
      title: 'In progress – current work',
      chip: 'In progress',
      date: 'Nov 2026',
      icon: 'loader',
    },
    {
      id: 'planned',
      title: 'Planned – next updates',
      chip: 'Planned',
      date: 'Q4 2026 – Q1 2027',
      icon: 'calendar-days',
    },
    {
      id: 'idea',
      title: 'Ideas – candidates for the future',
      chip: 'Idea',
      date: 'Backlog',
      icon: 'sparkles',
    },
  ];

  /** status: done | next | planned | idea · tag: short area label */
  const ITEMS = [
    /* ---------------- Shipped ---------------- */
    { status: 'done', title: 'Complete admin panel core', desc: 'Doctors (full CRUD + edit, 437 records), hospitals directory & profiles, appointments & duty schedules, patients and payments – all on SQLite.', tag: 'Panel' },
    { status: 'done', title: 'Doctor Full Profile – Media Gallery', desc: 'Photos + videos per doctor: multi-upload (images ≤10 MB, videos ≤50 MB), YouTube/Vimeo/direct video links, hover-to-delete, and automatic media cleanup when a doctor is deleted.', tag: 'Media' },
    { status: 'done', title: 'Hospital media (cover + logo upload)', desc: 'Hospital profile/cover image uploads with fallback visuals; a bootstep re-links the 9 committed card images so directory cards never lose their covers.', tag: 'Media' },
    { status: 'done', title: 'App Users management + remove-all', desc: 'Accounts & device tokens from the old source can be wiped with double-confirmation; new mobile registrations will populate the list again.', tag: 'App Users' },
    { status: 'done', title: 'Specialties & OPD grouping page', desc: 'Specialties table with doctor counts plus the exact mobile-app OPD groups in English + Urdu.', tag: 'Clinic' },
    { status: 'done', title: 'Notifications composer + backup history', desc: 'Panel-composed notifications carry a "Sent from panel" chip; the historical cards stay read-only.', tag: 'Notifications' },
    { status: 'done', title: 'My Ads – uploaded & linked banners', desc: 'Admin-created ads with title, details, date range and pause/resume; banner via upload or direct image/YouTube link with live preview.', tag: 'My Ads' },
    { status: 'done', title: 'PythonAnywhere deployment (live)', desc: 'https://Doctorv2.pythonanywhere.com is live – ASGI uvicorn on the domain socket, one-command pa_update.sh, and automatic DB backup before every update.', tag: 'Hosting' },
    { status: 'done', title: 'Performance upgrade: GZip + smart caching', desc: 'GZip compression (≥1 KB responses), year-long immutable caching for css/js/assets/uploads, 304 revalidation for HTML pages, API responses untouched.', tag: 'Speed' },
    { status: 'done', title: 'Single-source database synced through GitHub', desc: 'data/doctor_app.db and committed uploads travel with the repo: local push → PythonAnywhere adopts it (fetch + hard reset with PA-side backup).', tag: 'Data' },
    { status: 'done', title: 'Detached from the backup JSON', desc: 'No import happens at startup any more; the DB is the only data source. The old import is opt-in via DOCTOR_APP_IMPORT_BACKUP=1.', tag: 'Data' },
    { status: 'done', title: 'Cloud storage usage monitor', desc: 'Dashboard card tallies every R2 object live (total, per-folder, remaining of the 10 GB free tier) plus local disk media — so kitna data barh raha hai hamesha nazar mein.', tag: 'Media' },
    { status: 'done', title: 'Resources Vault (encrypted credentials)', desc: 'Private vault for hosting/database/ad/streaming accounts: name, category, purpose, URL, username, AES-encrypted password, comment. Passwords only revealed on demand and never travel with git.', tag: 'Vault' },
    { status: 'done', title: 'Stability & QA pass', desc: 'GZip/304/immutable verified under hosting versions, self-healing SQLite connection for async endpoints, lifespan + same-origin hosting fixes.', tag: 'QA' },

    /* ---------------- In progress ---------------- */
    { status: 'next', title: 'R2 master storage for videos (free egress)', desc: 'Code integration complete: video uploads now try Cloudflare R2 first (10 GB free, unlimited free egress) with automatic Cloudinary/local fallback and R2-aware deletion. Waiting on the bucket + API token to go live.', tag: 'Media' },
    { status: 'next', title: 'App Users re-seeding', desc: 'Old accounts removed on request; fresh, real accounts arrive once the updated mobile app and new rules take effect.', tag: 'App Users' },
    { status: 'next', title: 'Cloudinary media storage activation', desc: 'Move doctor/hospital images to Cloudinary (25 GB/month free CDN) so uploads stop travelling through git – code already supports it, only env keys remain.', tag: 'Media' },

    /* ---------------- Planned ---------------- */
    { status: 'planned', title: 'Dr App (Android) MVP', desc: 'Patient-facing Android app: login via app_users, doctors list + full profile (media gallery included), hospital duty slots, in-app notifications – built on the existing FastAPI endpoints.', tag: 'Dr App' },
    { status: 'planned', title: 'Read-only public API for the mobile app', desc: 'Token-free (or separate app-token), rate-limited GET endpoints so the Android app never needs the admin credentials.', tag: 'Dr App' },
    { status: 'planned', title: 'Video streaming via gumlet / hyperserve', desc: 'Once R2 playback is confirmed, stream through gumlet (250 GB/mo free) for adaptive bitrate, thumbnails and anti-scraping.', tag: 'Media' },
    { status: 'planned', title: 'App distribution plan', desc: 'Direct APK builds first (free – GitHub Releases / AndroidFileHost); Google Play ($25 one-time, not free) once the app is stable.', tag: 'Dr App' },
    { status: 'planned', title: 'Custom domain + Cloudflare', desc: 'Buy the domain, free Cloudflare DNS/SSL/CDN; Zoho Mail custom-domain mailbox (5 users free).', tag: 'Hosting' },
    { status: 'planned', title: 'Real push notifications (OneSignal)', desc: 'Unlimited free push to all app users; backend sends via OneSignal API instead of raw FCM tokens.', tag: 'Notifications' },
    { status: 'planned', title: 'Appointment email reminders (Brevo)', desc: 'Automated reminder emails using the free 9,000 emails/month Brevo tier.', tag: 'Email' },
    { status: 'planned', title: 'Booking flow for patients (web + Dr App)', desc: 'No-login booking form backed by the existing appointments API so patients pick hospital duty slots on the website or inside the app.', tag: 'Dr App' },
    { status: 'planned', title: 'Richer analytics dashboard', desc: 'Revenue vs appointments charts, specialty breakdown and monthly patient trends for the Overview page.', tag: 'Analytics' },

    /* ---------------- Ideas ---------------- */
    { status: 'idea', title: 'Managed cloud DB (Turso / Aiven)', desc: 'If SQLite ever reaches its limits, migrate to free post-PostgreSQL (Aiven 1 GB) or Turso (SQLite-in-cloud, 9 GB).', tag: 'Data' },
    { status: 'idea', title: 'Oracle Cloud free VPS', desc: '4 ARM cores + 24 GB RAM free tier as a stronger host if PythonAnywhere 512 MB becomes limiting.', tag: 'Hosting' },
    { status: 'idea', title: 'PDF exports – invoices & reports', desc: 'Monthly payments export/invoices (local Python libs or a free PDF API tier).', tag: 'Payments' },
    { status: 'idea', title: 'Automated weekly DB snapshots', desc: 'Encrypted offsite backups (Borgbase 10 GB free or scheduled GitHub Actions artifact).', tag: 'Data' },
  ];

  const LAST_UPDATED = '31 Oct 2026';

  function chip(status) {
    const g = GROUPS.find((x) => x.id === status) || GROUPS[0];
    return `<span class="rm-chip rm-chip--${g.id}">${g.chip}</span>`;
  }

  function item(model) {
    const g = GROUPS.find((x) => x.id === model.status) || GROUPS[0];
    const itemIcon = g.id === 'done' ? 'check-circle' : 'clock';
    return `
      <li class="rm-item rm-item--${g.id}">
        <span class="rm-item-icon">${icon(itemIcon)}</span>
        <div style="min-width:0;flex:1;">
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
            <span style="font-weight:600;">${Utils.escape(model.title)}</span>
            <span class="text-xs text-muted" style="text-transform:uppercase;letter-spacing:.05em;">${Utils.escape(model.tag)}</span>
          </div>
          <div class="text-sm text-muted" style="margin-top:.15rem;">${Utils.escape(model.desc)}</div>
        </div>
      </li>`;
  }

  function render() {
    /* legend chips + total */
    const counts = GROUPS.map((g) => `${g.chip}: ${ITEMS.filter((it) => it.status === g.id).length}`).join(' · ');
    $('#roadmapLegend').innerHTML =
      GROUPS.map((g) => chip(g.id)).join('') +
      `<span class="text-sm text-muted" style="margin-left:auto;">${counts}</span>`;

    $('#roadmapUpdated').textContent = `Last updated: ${LAST_UPDATED} · total items: ${ITEMS.length}`;

    /* group sections */
    $('#roadmapGroups').innerHTML = GROUPS.map((g) => {
      const list = ITEMS.filter((it) => it.status === g.id);
      return `
      <section class="card">
        <div class="card-header">
          <div>
            <div class="card-title" style="display:flex;gap:.5rem;align-items:center;">
              ${icon(g.icon)} ${Utils.escape(g.title)}
            </div>
            <div class="card-description">${Utils.escape(g.date)} · ${list.length} item${list.length === 1 ? '' : 's'}</div>
          </div>
          ${chip(g.id)}
        </div>
        <div class="card-content">
          <ul style="list-style:none;display:flex;flex-direction:column;gap:.5rem;margin:0;padding:0;" class="rm-sec rm-sec--${g.id}">
            ${list.map(item).join('') || '<div class="text-sm text-muted">No items yet.</div>'}
          </ul>
        </div>
      </section>`;
    }).join('');
  }

  const Roadmap = { init: render };
  window.Roadmap = Roadmap;
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', Roadmap.init)
    : Roadmap.init();
})();
