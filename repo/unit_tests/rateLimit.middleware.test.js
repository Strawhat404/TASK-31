import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../backend/src/middleware/rateLimit.js';
import { config } from '../backend/src/config.js';

/**
 * Rate-limit middleware unit tests.
 *
 * The middleware uses in-memory sliding-window counters (no DB dependency),
 * so it can be fully exercised in a unit-test environment.
 */

function mockCtx(overrides = {}) {
  return {
    ip: overrides.ip || '127.0.0.1',
    request: { ip: overrides.ip || '127.0.0.1' },
    state: overrides.state || {},
    status: 200,
    body: {}
  };
}

// ─── IP rate limiting ─────────────────────────────────────────────────────────

test('rateLimit: allows request when IP count is within limit', async () => {
  const ctx = mockCtx({ ip: `ip-ok-${Date.now()}` });
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await rateLimit(ctx, next);

  assert.equal(nextCalled, true, 'next() must be called for a normal request');
  assert.notEqual(ctx.status, 429, 'status must not be 429');
});

test('rateLimit: returns 429 with error body when IP limit is exceeded', async () => {
  // Use a unique IP so we don't collide with other tests
  const testIp = `ip-flood-${Date.now()}`;
  const limit = config.rateLimits.ipPerMinute;

  // Exhaust the IP limit
  for (let i = 0; i < limit; i++) {
    const ctx = mockCtx({ ip: testIp });
    await rateLimit(ctx, async () => {});
  }

  // The next request should be blocked
  const ctx = mockCtx({ ip: testIp });
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await rateLimit(ctx, next);

  assert.equal(ctx.status, 429, 'status must be 429 when IP limit exceeded');
  assert.deepEqual(ctx.body, { error: 'IP rate limit exceeded' });
  assert.equal(nextCalled, false, 'next() must not be called when rate limited');
});

// ─── User rate limiting ───────────────────────────────────────────────────────

test('rateLimit: allows authenticated request when user count is within limit', async () => {
  const ctx = mockCtx({
    ip: `ip-user-ok-${Date.now()}`,
    state: { user: { id: `user-ok-${Date.now()}` } }
  });
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await rateLimit(ctx, next);

  assert.equal(nextCalled, true, 'next() must be called for authenticated request within limit');
  assert.notEqual(ctx.status, 429, 'status must not be 429');
});

test('rateLimit: returns 429 with user error body when user limit is exceeded', async () => {
  const testIp = `ip-user-flood-${Date.now()}`;
  const userId = `user-flood-${Date.now()}`;
  const limit = config.rateLimits.userPerMinute;

  // Exhaust the user limit
  for (let i = 0; i < limit; i++) {
    const ctx = mockCtx({
      ip: testIp,
      state: { user: { id: userId } }
    });
    await rateLimit(ctx, async () => {});
  }

  // The next request should be blocked at the user level
  const ctx = mockCtx({
    ip: testIp,
    state: { user: { id: userId } }
  });
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await rateLimit(ctx, next);

  assert.equal(ctx.status, 429, 'status must be 429 when user limit exceeded');
  assert.deepEqual(ctx.body, { error: 'User rate limit exceeded' });
  assert.equal(nextCalled, false, 'next() must not be called when user rate limited');
});

// ─── Unauthenticated requests ─────────────────────────────────────────────────

test('rateLimit: unauthenticated requests are only subject to IP limit (no user check)', async () => {
  const ctx = mockCtx({ ip: `ip-noauth-${Date.now()}` });
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await rateLimit(ctx, next);

  assert.equal(nextCalled, true, 'unauthenticated request within IP limit must pass');
  assert.equal(ctx.state.user, undefined, 'ctx.state.user should be undefined');
});

// ─── IP fallback ──────────────────────────────────────────────────────────────

test('rateLimit: uses ctx.request.ip when ctx.ip is falsy', async () => {
  const ctx = {
    ip: '',
    request: { ip: `reqip-${Date.now()}` },
    state: {},
    status: 200,
    body: {}
  };
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await rateLimit(ctx, next);

  assert.equal(nextCalled, true, 'request with only request.ip should pass');
});

test('rateLimit: falls back to "unknown" when both ip fields are empty', async () => {
  const ctx = {
    ip: '',
    request: { ip: '' },
    state: {},
    status: 200,
    body: {}
  };
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await rateLimit(ctx, next);

  assert.equal(nextCalled, true, 'request with unknown IP should still pass within limit');
});

// ─── Response structure ───────────────────────────────────────────────────────

test('rateLimit: 429 response body has exactly one "error" key of type string', async () => {
  const testIp = `ip-struct-${Date.now()}`;
  const limit = config.rateLimits.ipPerMinute;

  for (let i = 0; i < limit; i++) {
    await rateLimit(mockCtx({ ip: testIp }), async () => {});
  }

  const ctx = mockCtx({ ip: testIp });
  await rateLimit(ctx, async () => {});

  assert.equal(ctx.status, 429);
  assert.ok(ctx.body.error, 'body must have error field');
  assert.equal(typeof ctx.body.error, 'string', 'error must be a string');
  assert.deepEqual(Object.keys(ctx.body), ['error'], 'body must only contain error key');
});

// ─── next() propagation ──────────────────────────────────────────────────────

test('rateLimit: calls next() and awaits it for valid requests', async () => {
  const ctx = mockCtx({ ip: `ip-next-${Date.now()}` });
  let order = [];
  const next = async () => { order.push('next'); };

  await rateLimit(ctx, next);
  order.push('after');

  assert.deepEqual(order, ['next', 'after'], 'next() must be awaited before rateLimit returns');
});
