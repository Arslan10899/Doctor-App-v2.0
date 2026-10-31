/* ==========================================================================
   Doctor Application – API client
   --------------------------------------------------------------------------
   Every request goes through this helper so that:
     * the auth token is attached automatically,
     * errors are normalised,
     * the base URL works both for the FastAPI server and for a static
       preview (where the API lives on a different host/port).
   ========================================================================== */

const Api = (() => {
  const STORAGE_TOKEN = 'doctor_app_token';
  const STORAGE_USER = 'doctor_app_user';

  /**
   * Candidate API base URLs, most likely first.
   * – when the page is served by the FastAPI app  -> same origin
   * – when opened from a static server (port 5500) -> fall back to the
   *   local backend port(s)
   */
  function baseUrlCandidates() {
    if (window.__API_BASE__) return [window.__API_BASE__];

    const { protocol, hostname, port } = window.location;
    /* Only dev-style static ports fall back to a local backend port.
       ("port === ''" is the normal https/http case (PythonAnywhere, hosting) –
        it must stay same-origin, otherwise the browser tries
        https://host:8000/api which is blocked by the host.) */
    const staticPorts = ['5500', '8080', '3000', '5173', '4200'];

    if (port && staticPorts.includes(port)) {
      const apiPort = window.__API_PORT__ || '8000';
      const altPort = apiPort === '8000' ? '8010' : '8000';
      return [
        `${protocol}//${hostname}:${apiPort}/api`,
        `${protocol}//${hostname}:${altPort}/api`,
      ];
    }
    return [`${protocol}//${hostname}:${port}/api`];
  }

  function baseUrl() {
    return baseUrlCandidates()[0];
  }

  let activeBase = null;

  function getToken() {
    return localStorage.getItem(STORAGE_TOKEN) || '';
  }

  function setToken(token) {
    if (token) localStorage.setItem(STORAGE_TOKEN, token);
    else localStorage.removeItem(STORAGE_TOKEN);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null');
    } catch (err) {
      return null;
    }
  }

  function setUser(user) {
    if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_USER);
  }

  async function request(path, { method = 'GET', body, params, raw = false } = {}) {
    const bases = activeBase ? [activeBase, ...baseUrlCandidates()] : baseUrlCandidates();

    let response;
    let lastError;

    for (const base of bases) {
      let url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

      if (params) {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            search.append(key, value);
          }
        });
        const qs = search.toString();
        if (qs) url += `?${qs}`;
      }

      const headers = { Accept: 'application/json' };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      let payload = body;
      if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }

      try {
        response = await fetch(url, { method, headers, body: payload });
        activeBase = base;
      } catch (err) {
        lastError = err;
        continue;
      }

      if (raw) {
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        return response.json();
      }

      let data = null;
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (err) {
          data = { detail: text };
        }
      }

      if (!response.ok) {
        const message = (data && (data.detail || data.message)) || `Request failed (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.payload = data;

        // Session expired or revoked -> go back to the sign-in page once.
        if (response.status === 401 && !path.startsWith('/auth/login')) {
          handleUnauthenticated();
        }

        throw error;
      }

      return data;
    }

    throw new Error(
      lastError
        ? 'Network error – could not reach the backend. Is it running (python run.py)?'
        : 'Network error – could not reach the backend.'
    );
  }

  function handleUnauthenticated() {
    setToken('');
    setUser(null);
    const page = window.location.pathname.split('/').pop();
    /* Version query (?v=2) is not part of the pathname. */
    if (page.split('?')[0] !== 'login.html') window.location.replace('login.html?v=38');
  }

  return {
    baseUrl,
    getToken,
    setToken,
    getUser,
    setUser,

    get: (path, params) => request(path, { params }),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
    upload: (path, formData) => request(path, { method: 'POST', body: formData, raw: true }),

    /* ---------------- endpoint helpers ---------------- */
    health: () => request('/health'),
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    me: () => request('/auth/me'),
    updateMe: (payload) => request('/auth/me', { method: 'PUT', body: payload }),
    changePassword: (currentPassword, newPassword) =>
      request('/auth/change-password', {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      }),
    uploadMyAvatar: (file) => {
      const form = new FormData();
      form.append('file', file);
      return request('/auth/avatar', { method: 'POST', body: form, raw: true });
    },

    dashboardStats: () => request('/dashboard/stats'),
    chartAppointments: (months = 12) => request('/dashboard/charts/appointments', { params: { months } }),
    chartRevenue: (months = 12) => request('/dashboard/charts/revenue', { params: { months } }),
    chartSpecialties: () => request('/dashboard/charts/specialties'),
    recentAppointments: (limit = 8) => request('/dashboard/recent-appointments', { params: { limit } }),
    topDoctors: (limit = 5) => request('/dashboard/top-doctors', { params: { limit } }),

    listDoctors: (params = {}) => request('/doctors', { params }),
    getDoctor: (id) => request(`/doctors/${id}`),
    createDoctor: (payload) => request('/doctors', { method: 'POST', body: payload }),
    updateDoctor: (id, payload) => request(`/doctors/${id}`, { method: 'PUT', body: payload }),
    deleteDoctor: (id) => request(`/doctors/${id}`, { method: 'DELETE' }),
    uploadAvatar: (id, file) => {
      const form = new FormData();
      form.append('file', file);
      return request(`/doctors/${id}/avatar`, { method: 'POST', body: form, raw: true });
    },

    specialties: () => request('/specialties'),
    opdSpecialties: () => request('/opd-specialties'),
    hospitals: () => request('/hospitals'),
    hospitalsDirectory: () => request('/hospitals/directory'),
    cities: () => request('/cities'),
    hospitalSchedules: (params = {}) => request('/hospital-schedules', { params }),
    uploadHospitalProfileImage: (id, file) => {
      const form = new FormData();
      form.append('file', file);
      return request(`/hospitals/${id}/profile-image`, { method: 'POST', body: form, raw: true });
    },
    uploadHospitalCoverImage: (id, file) => {
      const form = new FormData();
      form.append('file', file);
      return request(`/hospitals/${id}/cover-image`, { method: 'POST', body: form, raw: true });
    },

    /* ---- doctor profile media gallery -------------------------------- */
    doctorMedia: (id) => request(`/doctors/${id}/media`),
    uploadDoctorImages: (id, files) => {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      return request(`/doctors/${id}/media/images`, { method: 'POST', body: form, raw: true });
    },
    uploadDoctorVideoFile: (id, file) => {
      const form = new FormData();
      form.append('file', file);
      return request(`/doctors/${id}/media/video-file`, { method: 'POST', body: form, raw: true });
    },
    addDoctorVideoLink: (id, url) =>
      request(`/doctors/${id}/media/video-link`, { method: 'POST', body: { url } }),
    deleteDoctorMedia: (mediaId) => request(`/media/${mediaId}`, { method: 'DELETE' }),
    appUsers: (params = {}) => request('/app-users', { params }),
    appUserTokens: () => request('/app-users/tokens'),
    clearAppUsers: () => request('/app-users', { method: 'DELETE' }),
    notifications: (params = {}) => request('/notifications', { params }),
    sendNotification: (payload) => request('/notifications', { method: 'POST', body: payload }),
    deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
    myAds: () => request('/my-ads'),
    backupPromos: () => request('/backup-promos'),
    patients: (limit = 200) => request('/patients', { params: { limit } }),
    payments: (params = {}) => request('/payments', { params }),
    appointments: (params = {}) => request('/appointments', { params }),
  };
})();

window.Api = Api;
