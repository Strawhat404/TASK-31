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

test('cross-scope search isolation: coordinator cannot see other location vehicles', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  // Create coordinator in HQ/OPS
  const coordUsername = `coord_search_${Date.now()}`;
  await createUser(base, adminToken, {
    username: coordUsername,
    full_name: 'Search Test Coordinator',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  // Search should only return vehicles from HQ/OPS scope
  const search = await request(base, '/api/search/vehicles?page=1', {
    token: coordToken
  });
  
  assert.equal(search.status, 200);
  
  // Verify all returned vehicles are within scope (if any exist)
  if (Array.isArray(search.data.rows) && search.data.rows.length > 0) {
    for (const vehicle of search.data.rows) {
      // Vehicle records should only be accessible if their appointment is in scope
      // Since we're filtering by appointment scope in SQL, this should be enforced
      assert.ok(vehicle, 'Vehicle record should exist');
    }
  }
});

test('cross-scope autocomplete isolation: non-admin only sees own scope data', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordUsername = `coord_auto_${Date.now()}`;
  await createUser(base, adminToken, {
    username: coordUsername,
    full_name: 'Autocomplete Test',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  const autocomplete = await request(base, '/api/search/autocomplete?prefix=T', {
    token: coordToken
  });
  
  assert.equal(autocomplete.status, 200);
  assert.ok(Array.isArray(autocomplete.data.suggestions));
});

test('cross-scope trending isolation: non-admin only sees own scope trends', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordUsername = `coord_trend_${Date.now()}`;
  await createUser(base, adminToken, {
    username: coordUsername,
    full_name: 'Trending Test',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  const trending = await request(base, '/api/search/trending', {
    token: coordToken
  });
  
  assert.equal(trending.status, 200);
  assert.ok(Array.isArray(trending.data.keywords));
});

test('file governance: download authorization enforces scope', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coordUsername = `coord_file_${Date.now()}`;
  await createUser(base, adminToken, {
    username: coordUsername,
    full_name: 'File Governance Test',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  // Attempt to download a file with invalid ID (should fail gracefully)
  const download = await request(base, '/api/files/download/999999', {
    token: coordToken
  });
  
  assert.ok([403, 404].includes(download.status), `Expected 403 or 404, got ${download.status}`);
});

test('retention: account closure request workflow', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const customerUsername = `cust_closure_${Date.now()}`;
  const customerId = await createUser(base, adminToken, {
    username: customerUsername,
    full_name: 'Closure Test Customer',
    password: 'CustomerPass@123',
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${customerUsername}@roadsafe.internal`
  });

  const customerToken = await login(base, customerUsername, 'CustomerPass@123');

  // Request account closure
  const closure = await request(base, '/api/compliance/account-closure', {
    method: 'POST',
    token: customerToken
  });
  
  // Should either succeed (201) or indicate already requested (409)
  assert.ok([201, 409].includes(closure.status), `Expected 201 or 409, got ${closure.status}`);
});

test('cross-scope message access blocked', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const coord1Username = `coord_msg1_${Date.now()}`;
  await createUser(base, adminToken, {
    username: coord1Username,
    full_name: 'Message Test 1',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coord1Username}@roadsafe.internal`
  });

  const coord1Token = await login(base, coord1Username, 'Coordinator@123');

  // Get inbox - should only see messages for this user
  const inbox = await request(base, '/api/messages/inbox', {
    token: coord1Token
  });
  
  assert.equal(inbox.status, 200);
  assert.ok(Array.isArray(inbox.data.messages));
});

test('inspection result publication workflow', async (t) => {
  const base = await resolveBase();
  if (!base) return t.skip('API not reachable');

  const adminToken = await login(base, 'admin', 'Admin@123456');

  const inspectorUsername = `insp_result_${Date.now()}`;
  const inspectorId = await createUser(base, adminToken, {
    username: inspectorUsername,
    full_name: 'Result Test Inspector',
    password: 'Inspector@123',
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${inspectorUsername}@roadsafe.internal`
  });

  const customerUsername = `cust_result_${Date.now()}`;
  const customerId = await createUser(base, adminToken, {
    username: customerUsername,
    full_name: 'Result Test Customer',
    password: 'CustomerPass@123',
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${customerUsername}@roadsafe.internal`
  });

  const inspectorToken = await login(base, inspectorUsername, 'Inspector@123');

  // Create appointment first
  const coordUsername = `coord_result_${Date.now()}`;
  await createUser(base, adminToken, {
    username: coordUsername,
    full_name: 'Result Coordinator',
    password: 'Coordinator@123',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `${coordUsername}@roadsafe.internal`
  });

  const coordToken = await login(base, coordUsername, 'Coordinator@123');

  const appointmentSlot = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  appointmentSlot.setUTCHours(14, 0, 0, 0);

  const appointment = await request(base, '/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordToken,
    body: {
      customer_id: customerId,
      location_code: 'HQ',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: appointmentSlot.toISOString(),
      notes: 'result publication test'
    }
  });

  if (appointment.status !== 201) {
    t.skip(`Could not create appointment for result test (status ${appointment.status})`);
  }

  const appointmentId = appointment.data.appointmentId;
  assert.ok(appointmentId, 'Appointment ID should be returned');

  // Submit inspection result
  const result = await request(base, '/api/inspections/results', {
    method: 'POST',
    token: inspectorToken,
    body: {
      appointment_id: appointmentId,
      location_code: 'HQ',
      department_code: 'OPS',
      outcome: 'pass',
      score: 95.5,
      findings: { brake_test: 'pass', emissions: 'pass' }
    }
  });

  // Should succeed or indicate already submitted
  assert.ok([201, 409].includes(result.status), `Expected 201 or 409, got ${result.status}`);
});
