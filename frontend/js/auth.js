/* ==========================================================================
   Doctor Application – login page
   ========================================================================== */

const Auth = (() => {
  function showError(message) {
    const box = document.getElementById('loginError');
    if (!box) return;
    box.textContent = message;
    box.classList.remove('hidden');
  }

  function hideError() {
    document.getElementById('loginError')?.classList.add('hidden');
  }

  async function submit(event) {
    event.preventDefault();
    hideError();

    const button = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showError('Please enter both your email and password.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Signing in…';

    try {
      const data = await Api.login(email, password);
      Api.setToken(data.token);
      Api.setUser(data.user);
      toast(`Welcome back, ${data.user.name || 'Admin'}!`, 'success');
      setTimeout(() => {
        window.location.href = 'index.html?v=19';
      }, 450);
    } catch (err) {
      showError(err.message || 'Invalid email or password.');
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  }

  function init() {
    const form = document.getElementById('loginForm');
    if (form) form.addEventListener('submit', submit);

    const toggle = document.getElementById('togglePassword');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const input = document.getElementById('loginPassword');
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    }

    const fillDemo = document.getElementById('fillDemo');
    if (fillDemo) {
      fillDemo.addEventListener('click', () => {
        document.getElementById('loginEmail').value = 'admin@doctorapp.com';
        document.getElementById('loginPassword').value = 'admin123';
        document.getElementById('loginPassword').focus();
      });
    }

    document.getElementById('forgotLink')?.addEventListener('click', (event) => {
      event.preventDefault();
      toast('Password reset will be handled by Firebase Auth once enabled.', 'info');
    });

    // Already signed in? Go straight to the dashboard.
    if (Api.getToken()) {
      Api.me()
        .then(() => {
          window.location.replace('index.html?v=19');
        })
        .catch(() => Api.setToken(''));
    }
  }

  return { init };
})();

window.Auth = Auth;
document.addEventListener('DOMContentLoaded', Auth.init);
