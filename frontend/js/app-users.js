/* ==========================================================================
   Doctor Application – App Users page
   Mobile app audience imported from the backup's "users" collection:
   registered accounts (name/email/role/earning) plus FCM device tokens
   used for push notifications.
   ========================================================================== */

const AppUsers = (() => {
  let state = {
    search: '',
    registered: 'all',
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  };

  const $ = (s) => document.querySelector(s);

  /* ---------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------- */
  function shortToken(token) {
    if (!token) return null;
    return token.length > 46 ? `${token.slice(0, 46)}…` : token;
  }

  function summarize(summary) {
    const chips = [
      { value: Utils.number(summary.total), label: 'Total app users' },
      { value: Utils.number(summary.registered), label: 'Registered accounts' },
      { value: Utils.number(summary.total - summary.registered), label: 'Device tokens only' },
      { value: Utils.number(summary.with_token), label: 'With push token' },
    ];
    $('#auSummary').innerHTML = chips
      .map(
        (c) => `
        <div class="au-chip">
          <div class="au-chip-value">${c.value}</div>
          <div class="au-chip-label">${Utils.escape(c.label)}</div>
        </div>`
      )
      .join('');
  }

  function row(user) {
    const isReg = user.is_registered === 1;
    const typeBadge = isReg
      ? `<span class="au-badge is-registered">${window.Icon('user-round')} Registered</span>`
      : `<span class="au-badge">${window.Icon('smartphone')} Device token only</span>`;
    const displayName = user.name || (user.email ? user.email.split('@')[0] : `User ${user.id}`);
    const token = user.device_token
      ? `<span class="au-token" title="${Utils.escape(user.device_token)}">${Utils.escape(shortToken(user.device_token))}</span>
         <button type="button" class="au-copy" data-copy="${Utils.escape(user.device_token)}" title="Copy full token">${window.Icon('copy')}</button>`
      : '<span class="text-xs text-muted">No token</span>';

    return `
      <tr data-id="${user.id}">
        <td>
          <div style="display:flex;align-items:center;gap:.75rem;">
            <div class="avatar ${Utils.avatarColor(displayName)}">${Utils.escape(Utils.initials(displayName))}</div>
            <div style="min-width:0;">
              <div class="cell-strong">${Utils.escape(user.name || '—')}</div>
              <div class="cell-muted text-xs">${Utils.escape(user.email || `${user.id} · app install`)}</div>
            </div>
          </div>
        </td>
        <td>${Utils.escape(user.role || '—')}</td>
        <td>${typeBadge}</td>
        <td>${isReg ? Utils.money(user.earning) : '—'}</td>
        <td>${token}</td>
      </tr>
    `;
  }

  function renderPagination() {
    const host = $('#pagination');
    if (!host) return;
    if (state.pages <= 1) {
      host.innerHTML = '';
      return;
    }

    const pages = [];
    for (let page = 1; page <= state.pages; page += 1) {
      if (state.pages > 7 && page > 2 && page < state.pages - 1) {
        if (page === 3 || page === state.pages - 2) {
          pages.push('<span class="text-sm text-muted">…</span>');
        }
        continue;
      }
      pages.push(
        `<button type="button" class="page-btn ${page === state.page ? 'is-active' : ''}" data-page="${page}">${page}</button>`
      );
    }
    host.innerHTML =
      `<button type="button" class="page-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹</button>` +
      pages.join('') +
      `<button type="button" class="page-btn" data-page="${state.page + 1}" ${state.page === state.pages ? 'disabled' : ''}>›</button>`;

    host.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = Number(btn.dataset.page);
        if (page >= 1 && page <= state.pages) {
          state.page = page;
          load();
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
   * Data
   * ------------------------------------------------------------------- */
  async function load() {
    try {
      const data = await Api.appUsers({
        search: state.search || undefined,
        registered: state.registered === 'all' ? undefined : state.registered,
        page: state.page,
        limit: state.limit,
      });

      state.total = data.total;
      state.pages = data.pages;

      if (data.summary) summarize(data.summary);

      $('#appUserTableBody').innerHTML = data.items.map(row).join('');
      $('#appUsersEmpty').classList.toggle('hidden', data.items.length > 0);

      const start = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
      const end = Math.min(state.page * state.limit, state.total);
      $('#resultsInfo').textContent = `Showing ${start}–${end} of ${Utils.number(state.total)} app users`;

      document.querySelectorAll('.au-copy[data-copy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          navigator.clipboard?.writeText(btn.dataset.copy);
          btn.title = 'Copied!';
        });
      });

      renderPagination();
    } catch (err) {
      $('#resultsInfo').textContent = err.message || 'Could not load app users.';
    }
  }

  /* ---------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------- */
  function init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('search')) {
      state.search = params.get('search');
      $('#appUserSearch').value = state.search;
    }

    const search = $('#appUserSearch');
    search?.addEventListener(
      'input',
      Utils.debounce(() => {
        state.search = search.value.trim();
        state.page = 1;
        load();
      }, 350)
    );

    $('#registeredFilter')?.addEventListener('change', (e) => {
      state.registered = e.target.value;
      state.page = 1;
      load();
    });

    /* one click -> every FCM push token on the clipboard, ready for a
       Firebase console / API push campaign */
    $('#copyTokensBtn')?.addEventListener('click', async () => {
      const btn = $('#copyTokensBtn');
      btn.disabled = true;
      try {
        const data = await Api.appUserTokens();
        if (!data.tokens?.length) {
          toast('No device tokens stored yet.', 'info');
          return;
        }
        await navigator.clipboard.writeText(data.tokens.join('\n'));
        toast(`${Utils.number(data.total)} push tokens copied to the clipboard.`, 'success');
      } catch (err) {
        toast(err.message || 'Could not copy the tokens.', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    /* remove every app-user account (double confirm – destructive) */
    $('#clearAppUsersBtn')?.addEventListener('click', async () => {
      if (!confirm('Sare app-user accounts remove karein? (device tokens + registered accounts)')) return;
      if (!confirm('Ye action wapas nahi hoga. Pehli confirm karein: sab accounts delete?')) return;
      const btn = $('#clearAppUsersBtn');
      btn.disabled = true;
      try {
        const res = await Api.clearAppUsers();
        toast(res.message || 'Sare app users remove ho gaye.', 'success');
        state.page = 1;
        await load();
      } catch (err) {
        toast(err.message || 'Remove nahi hua.', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    load();
  }

  return { init };
})();

window.AppUsers = AppUsers;
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', AppUsers.init)
  : AppUsers.init();
