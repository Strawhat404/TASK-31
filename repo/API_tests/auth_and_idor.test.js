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
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

async function login(base, username, password) {
  const { status, data } = await request(base, '/api/auth/login', {
    method: 'POST',
    body: { username, password }
  });
  assert.equal(status, 200, `login failed for ${username}: ${JSON.stringify(data)}`);
  return data.token;
}

async function registerUser(base, adminToken, payload) {
  const res = await request(base, '/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: payload
  });
  assert.equal(res.status, 201, `register failed: ${JSON.stringify(res.data)}`);
}

test('unauthenticated requests to protected routes return 401', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const routes = [
    '/api/users?page=1&pageSize=5',
    '/api/coordinator/bay-utilization',
    '/api/coordinator/waiting-room/seats',
    '/api/search/vehicles?page=1',
    '/api/messages/inbox',
    '/api/audit/events'
  ];

  for (const route of routes) {
    const { status } = await request(base, route);
    assert.equal(status, 401, `expected 401 for ${route}, got ${status}`);
  }
});

test('non-admin cannot register users (403)', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordUsername = `coord_reg_${Date.now()}`;
  await registerUser(base, adminToken, {
    username: coordUsername,
    full_name: 'Reg Test Coord',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  const { status } = await request(base, '/api/auth/register', {
    method: 'POST',
    token: coordToken,
    body: {
      username: `should_fail_${Date.now()}`,
      full_name: 'Should Fail',
      password: 'ShouldFail@123',
      role_name: 'Inspector',
      location_code: 'HQ',
      department_code: 'OPS',
      email: `fail_${Date.now()}@roadsafe.internal`
    }
  });
  assert.equal(status, 403);
});

test('invalid credentials return 401', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const { status } = await request(base, '/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'WrongPassword!' }
  });
  assert.equal(status, 401);
});

test('missing required fields on register return 400', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const { status, data } = await request(base, '/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: { username: 'incomplete_user' }
  });
  assert.equal(status, 400);
  assert.ok(data.error);
});

test('IDOR: coordinator cannot access admin-only users list', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordUsername = `coord_idor_${Date.now()}`;
  await registerUser(base, adminToken, {
    username: coordUsername,
    full_name: 'IDOR Test Coord',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  // Admin-only endpoint
  const { status } = await request(base, '/api/users?page=1&pageSize=5', { token: coordToken });
  assert.equal(status, 403);
});

test('IDOR: seat assignment with out-of-scope appointment_id returns 403', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordUsername = `coord_seat_idor_${Date.now()}`;
  await registerUser(base, adminToken, {
    username: coordUsername,
    full_name: 'Seat IDOR Coord',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  const { status } = await request(base, '/api/coordinator/waiting-room/assign-seat', {
    method: 'POST',
    token: coordToken,
    body: { seat_id: 1, appointment_id: 999999, location_code: 'HQ', department_code: 'OPS' }
  });
  assert.equal(status, 403);
});

test('cross-scope scheduling returns 403', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordUsername = `coord_scope_${Date.now()}`;
  await registerUser(base, adminToken, {
    username: coordUsername,
    full_name: 'Scope Test Coord',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  const { status } = await request(base, '/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordToken,
    body: {
      customer_id: 1,
      location_code: 'BRANCH',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: '2027-01-01T10:00:00Z',
      notes: 'cross scope test'
    }
  });
  assert.equal(status, 403);
});

test('logout invalidates session token', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordUsername = `coord_logout_${Date.now()}`;
  await registerUser(base, adminToken, {
    username: coordUsername,
    full_name: 'Logout Test',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const token = await login(base, coordUsername, 'Coordinator@123');

  const logoutRes = await request(base, '/api/auth/logout', { method: 'POST', token });
  assert.equal(logoutRes.status, 200);

  // Token should now be invalid
  const afterLogout = await request(base, '/api/auth/me', { token });
  assert.equal(afterLogout.status, 401);
});
