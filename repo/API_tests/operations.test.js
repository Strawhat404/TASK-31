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

  const list = await request(
    base,
    `/api/users?page=1&pageSize=5&q=${encodeURIComponent(payload.username)}`,
    { token: adminToken }
  );
  assert.equal(list.status, 200);
  const found = (list.data.rows || []).find((u) => u.username === payload.username);
  assert.ok(found, `user not found after create: ${payload.username}`);
  return found.id;
}

function slotAt(daysFromNow, hour, minute) {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

test('operations: duplicate appointment conflict and 5-minute submission lock', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordinatorUsername = `coord_ops_${Date.now()}`;
  const coordinatorId = await createUser(base, adminToken, {
    username: coordinatorUsername,
    full_name: 'Operations Coordinator',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordinatorUsername}@roadsafe.internal`
  });
  assert.ok(coordinatorId > 0);

  const customerUsername = `cust_ops_${Date.now()}`;
  const customerId = await createUser(base, adminToken, {
    username: customerUsername,
    full_name: 'Operations Customer',
    password: 'CustomerPass@123',
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${customerUsername}@roadsafe.internal`
  });
  assert.ok(customerId > 0);

  const coordinatorToken = await login(base, coordinatorUsername, 'Coordinator@123');

  const basePayload = {
    customer_id: customerId,
    location_code: 'HQ',
    department_code: 'OPS',
    vehicle_type: 'light',
    notes: 'operations test'
  };

  const duplicateSlot = slotAt(2, 10, 0);
  const firstDuplicateCandidate = await request(base, '/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: { ...basePayload, scheduled_at: duplicateSlot }
  });

  if (firstDuplicateCandidate.status === 201) {
    const duplicate = await request(base, '/api/coordinator/appointments/schedule', {
      method: 'POST',
      token: coordinatorToken,
      body: { ...basePayload, scheduled_at: duplicateSlot }
    });
    assert.equal(duplicate.status, 409);
  } else {
    assert.ok([409, 400].includes(firstDuplicateCandidate.status));
  }

  const lockSlot1 = slotAt(3, 11, 0);
  const lockSlot2 = slotAt(3, 11, 30);

  const first = await request(base, '/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: { ...basePayload, scheduled_at: lockSlot1 }
  });

  if (first.status !== 201) {
    t.skip(`could not create initial appointment for lock check (status ${first.status})`);
  }

  const second = await request(base, '/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: { ...basePayload, scheduled_at: lockSlot2 }
  });

  assert.equal(second.status, 409);
  assert.match(String(second.data.error || ''), /submission lock/i);
});
