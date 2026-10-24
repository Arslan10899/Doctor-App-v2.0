/* ==========================================================================
   Doctor Application – shared utilities
   ========================================================================== */

const Utils = {
  /* ---------------------------------------------------------------------
   * Escaping
   * ------------------------------------------------------------------- */
  escape(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /* ---------------------------------------------------------------------
   * Numbers & money
   * ------------------------------------------------------------------- */
  number(value, decimals = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('en-PK', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },

  /** Compact money format: Rs 1.2M / Rs 450.0K / Rs 1,250 */
  money(value, { compact = false, decimals = 0 } = {}) {
    const num = Number(value) || 0;
    if (compact && Math.abs(num) >= 1000) {
      const units = [
        { limit: 1e9, suffix: 'B' },
        { limit: 1e6, suffix: 'M' },
        { limit: 1e3, suffix: 'K' },
      ];
      for (const unit of units) {
        if (Math.abs(num) >= unit.limit) {
          const scaled = num / unit.limit;
          return `Rs ${scaled.toFixed(scaled >= 100 ? 0 : 1)}${unit.suffix}`;
        }
      }
    }
    return `Rs ${this.number(num, decimals)}`;
  },

  compact(value) {
    const num = Number(value) || 0;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return String(num);
  },

  percent(value, decimals = 1) {
    const num = Number(value) || 0;
    return `${num.toFixed(decimals)}%`;
  },

  /* ---------------------------------------------------------------------
   * Dates
   * ------------------------------------------------------------------- */
  parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    // "YYYY-MM-DD" is parsed as UTC by Date -> normalise to local
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
    const date = this.parseDate(value);
    if (!date) return '—';
    return date.toLocaleDateString('en-GB', options);
  },

  formatDateTime(value) {
    const date = this.parseDate(value);
    if (!date) return '—';
    return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString(
      'en-GB',
      { hour: '2-digit', minute: '2-digit' }
    )}`;
  },

  relativeTime(value) {
    const date = this.parseDate(value);
    if (!date) return '—';
    const diff = Date.now() - date.getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return this.formatDate(date);
  },

  greeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
  },

  /* ---------------------------------------------------------------------
   * Avatars
   * ------------------------------------------------------------------- */
  initials(name) {
    if (!name) return '?';
    const cleaned = String(name).replace(/^Dr\.?\s+/i, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  avatarColor(name) {
    const str = String(name || '');
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `avatar-${(Math.abs(hash) % 6) + 1}`;
  },

  /**
   * Build the HTML for an avatar.
   * @param {{name?:string, avatar_url?:string|null, size?:string}} doctor
   */
  avatar(doctor, size = '') {
    const name = doctor?.name || 'Unknown';
    const url = doctor?.avatar_url && /^(https?:\/\/|\/)/.test(doctor.avatar_url)
      ? doctor.avatar_url
      : '';
    const cls = `avatar ${size} ${url ? '' : Utils.avatarColor(name)}`;
    if (url) {
      return `<div class="${cls}"><img src="${Utils.escape(url)}" alt="${Utils.escape(
        name
      )}" loading="lazy" onerror="this.parentElement.className='avatar ${size} ${Utils.avatarColor(
        name
      )}';this.remove();"></div>`;
    }
    return `<div class="${cls}">${Utils.escape(Utils.initials(name))}</div>`;
  },

  /* ---------------------------------------------------------------------
   * Status helpers
   * ------------------------------------------------------------------- */
  statusBadge(status) {
    const map = {
      Active: 'badge-success',
      'On Leave': 'badge-warning',
      Inactive: 'badge-muted',
      Completed: 'badge-success',
      Scheduled: 'badge-info',
      Pending: 'badge-warning',
      Cancelled: 'badge-destructive',
      Paid: 'badge-success',
      Unpaid: 'badge-warning',
      Refunded: 'badge-muted',
    };
    const cls = map[status] || 'badge-secondary';
    return `<span class="badge ${cls}">${Utils.escape(status || '—')}</span>`;
  },

  statusDot(status) {
    const map = {
      Active: 'dot-success',
      Completed: 'dot-success',
      Scheduled: 'dot-success',
      'On Leave': 'dot-warning',
      Pending: 'dot-warning',
      Unpaid: 'dot-warning',
      Cancelled: 'dot-destructive',
      Inactive: 'dot-muted',
      Refunded: 'dot-muted',
    };
    return `<span class="dot ${map[status] || 'dot-muted'}"></span>`;
  },

  stars(rating) {
    const value = Number(rating) || 0;
    const full = Math.round(value);
    let html = '<span class="stars" title="' + value.toFixed(1) + ' out of 5">';
    for (let i = 1; i <= 5; i += 1) {
      const filled = i <= full;
      html += `<svg class="icon" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
    html += `</span>`;
    return html;
  },

  /* ---------------------------------------------------------------------
   * Misc
   * ------------------------------------------------------------------- */
  debounce(fn, wait = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  initialsFromEmail(email) {
    return this.initials(String(email || 'A').split('@')[0]);
  },

  downloadCsv(filename, rows) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            const text = value === null || value === undefined ? '' : String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

/* -------------------------------------------------------------------------
 * Toast notifications
 * ---------------------------------------------------------------------- */
function createToastStack() {
  let stack = document.getElementById('toastStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

function toast(message, type = 'success', timeout = 3600) {
  const stack = createToastStack();
  const icons = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'clock',
    info: 'help-circle',
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${window.Icon(icons[type] || 'help-circle')}<div>${Utils.escape(message)}</div>`;
  stack.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity .2s ease, transform .2s ease';
    setTimeout(() => el.remove(), 220);
  }, timeout);

  return el;
}

window.Utils = Utils;
window.toast = toast;
