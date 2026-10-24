/* ==========================================================================
   Doctor Application – light / dark theme
   ========================================================================== */

const Theme = (() => {
  const STORAGE_KEY = 'doctor_app_theme';

  function stored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /** Apply a theme to the document. */
  function apply(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    return isDark;
  }

  function current() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      /* ignore */
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    return next;
  }

  /** Called once at start-up (after the inline head script already applied it). */
  function init() {
    apply(stored() || (prefersDark() ? 'dark' : 'light'));
    syncButton();
    bindToggle();
  }

  /** Keeps the toggle button icon in sync with the active theme. */
  function syncButton() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const next = current();
    button.innerHTML = window.Icon(next === 'dark' ? 'moon' : 'sun');
    button.setAttribute(
      'aria-label',
      next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  function bindToggle() {
    const button = document.getElementById('themeToggle');
    if (!button || button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      toggle();
      syncButton();
    });
  }

  return { apply, current, toggle, init, stored, syncButton, bindToggle };
})();

window.Theme = Theme;
document.addEventListener('DOMContentLoaded', Theme.init);
