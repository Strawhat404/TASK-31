import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function resolveBase() {
  const candidates = [process.env.API_BASE_URL, 'https://localhost:4000', 'http://localhost:4000'].filter(Boolean);
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return base;
    } catch {
      // continue
    }
  }
  return null;
}

async function request(base, path, { method = 'GET', token = '', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}`, 'X-CSRF-Token': token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

async function login(base, username, password) {
  const { status, data } = await request(base, '/api/auth/login', {
    method: 'POST',
    body: { username, password }
  });
  assert.equal(status, 200, `login failed for ${username}: ${JSON.stringify(data)}`);
  assert.ok(data.token);
  return data.token;
}

test('auth flow: login, password complexity rejection, 401 and 403 scope denials', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const unauthorized = await request(base, '/api/users?page=1&pageSize=5');
  assert.equal(unauthorized.status, 401);

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const shortPassword = await request(base, '/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: {
      username: `short_pw_${Date.now()}`,
      full_name: 'Short Password User',
      password: 'Weak1!',
      role_name: 'Coordinator',
      location_code: 'HQ',
      department_code: 'OPS',
      email: `short_pw_${Date.now()}@roadsafe.internal`
    }
  });
  assert.equal(shortPassword.status, 400);
  assert.match(String(shortPassword.data.error || ''), /at least 12 chars/i);

  const coordinatorUsername = `coord_auth_${Date.now()}`;
  const createCoordinator = await request(base, '/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: {
      username: coordinatorUsername,
      full_name: 'Coordinator Auth Test',
      password: 'Coordinator@123',
      role_name: 'Coordinator',
      location_code: 'HQ',
      department_code: 'OPS',
      email: `${coordinatorUsername}@roadsafe.internal`
    }
  });
  assert.equal(createCoordinator.status, 201);

  const coordinatorToken = await login(base, coordinatorUsername, 'Coordinator@123');

  const crossScope = await request(base, '/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: {
      customer_id: 1,
      location_code: 'OTHER',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: '2026-12-01T10:00:00Z',
      notes: 'cross scope auth test'
    }
  });
  assert.equal(crossScope.status, 403);
});
