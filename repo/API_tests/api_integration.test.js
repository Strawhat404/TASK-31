import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', token = '', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
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

async function login(username, password) {
  const { status, data } = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password }
  });
  assert.equal(status, 200, `login failed for ${username}: ${JSON.stringify(data)}`);
  assert.ok(data.token, 'missing auth token');
  return data.token;
}

async function ensureUser(adminToken, payload) {
  const { status } = await request('/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: payload
  });

  // Allow duplicate user/email from prior runs.
  assert.ok([201, 500, 400].includes(status));
}

async function apiReachable() {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

test('401 Unauthorized without bearer token', async (t) => {
  if (!(await apiReachable())) t.skip('API not reachable on localhost:4000');

  const { status } = await request('/api/users?page=1&pageSize=10');
  assert.equal(status, 401);
});

test('403 Forbidden on cross-scope coordinator scheduling attempt', async (t) => {
  if (!(await apiReachable())) t.skip('API not reachable on localhost:4000');

  const adminToken = await login('admin', 'Admin@123456');
  const coordinatorUsername = `coord_scope_${Date.now()}`;

  await ensureUser(adminToken, {
    username: coordinatorUsername,
    full_name: 'Scope Coordinator',
    password: 'CoordScope@1234',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordinatorUsername}@roadsafe.internal`
  });

  const coordinatorToken = await login(coordinatorUsername, 'CoordScope@1234');

  const { status } = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: {
      customer_id: 1,
      location_code: 'OTHER',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      notes: 'cross-scope check'
    }
  });

  assert.equal(status, 403);
});

test('409 Conflict on duplicate appointment creation', async (t) => {
  if (!(await apiReachable())) t.skip('API not reachable on localhost:4000');

  const adminToken = await login('admin', 'Admin@123456');

  const inspectorUsername = `inspector_${Date.now()}`;
  await ensureUser(adminToken, {
    username: inspectorUsername,
    full_name: 'Test Inspector',
    password: 'Inspector@1234',
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${inspectorUsername}@roadsafe.internal`
  });

  const now = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const minute = now.getUTCMinutes() >= 30 ? 30 : 0;
  now.setUTCMinutes(minute, 0, 0);

  const payload = {
    customer_id: 1,
    location_code: 'HQ',
    department_code: 'OPS',
    vehicle_type: 'light',
    scheduled_at: now.toISOString(),
    notes: 'duplicate-check'
  };

  const first = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: adminToken,
    body: payload
  });
  assert.ok([201, 409].includes(first.status), `unexpected first status: ${first.status}`);

  const second = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: adminToken,
    body: payload
  });

  assert.equal(second.status, 409, `expected 409, got ${second.status} with ${JSON.stringify(second.data)}`);
});
