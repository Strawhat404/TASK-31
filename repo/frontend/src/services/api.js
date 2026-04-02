const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}`, 'X-CSRF-Token': token } : {};
}

async function request(path, token, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...authHeaders(token)
    }
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return body;
}

export async function apiGet(path, token) {
  return request(path, token, { method: 'GET' });
}

export async function apiPost(path, token, payload) {
  return request(path, token, { method: 'POST', body: JSON.stringify(payload || {}) });
}

export async function apiPut(path, token, payload) {
  return request(path, token, { method: 'PUT', body: JSON.stringify(payload || {}) });
}

export async function login(username, password) {
  return apiPost('/api/auth/login', '', { username, password });
}

export async function me(token) {
  return apiGet('/api/auth/me', token);
}

export async function logout(token) {
  return apiPost('/api/auth/logout', token, {});
}

export async function fetchSummary(token) {
  return apiGet('/api/dashboard/summary', token);
}

export async function fetchCoordinatorView(token) {
  return apiGet('/api/dashboard/coordinator-view', token);
}

export async function fetchIngestionHealth(token) {
  return apiGet('/api/dashboard/ingestion-health', token);
}
