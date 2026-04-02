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
  return data.token;
}

async function createUser(base, adminToken, payload) {
  const { status } = await request(base, '/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: payload
  });
  assert.equal(status, 201);
}

test('security: IDOR seat assignment blocked and sensitive fields masked for non-admin', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordinatorUsername = `coord_security_${Date.now()}`;
  await createUser(base, adminToken, {
    username: coordinatorUsername,
    full_name: 'Security Coordinator',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordinatorUsername}@roadsafe.internal`
  });

  const coordinatorToken = await login(base, coordinatorUsername, 'Coordinator@123');

  const idor = await request(base, '/api/coordinator/waiting-room/assign-seat', {
    method: 'POST',
    token: coordinatorToken,
    body: {
      seat_id: 1,
      appointment_id: 999999,
      location_code: 'HQ',
      department_code: 'OPS'
    }
  });
  assert.equal(idor.status, 403);

  const search = await request(base, '/api/search/vehicles?page=1', {
    token: coordinatorToken
  });
  assert.equal(search.status, 200);
  if (Array.isArray(search.data.rows) && search.data.rows.length > 0) {
    assert.equal(search.data.rows[0].plate_number, '***REDACTED***');
    assert.equal(search.data.rows[0].vin, '***REDACTED***');
  }
});
