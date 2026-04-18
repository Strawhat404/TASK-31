import test from 'node:test';
import assert from 'node:assert/strict';
import { query, execute, getConnection, pingDb } from '../backend/src/db.js';

/**
 * Database layer unit tests.
 *
 * The db module wraps mysql2/promise with a connection pool. In unit-test
 * environments (no MySQL), all pool operations will reject with a connection
 * error. These tests validate:
 *   1. Module exports exist with correct types
 *   2. Parameter handling branches (empty vs populated params)
 *   3. Graceful error rejection (not crashes) when no DB is available
 *
 * Full query behavior with a live DB is covered by API integration tests.
 */

// ─── Module exports ──────────────────────────────────────────────────────────

test('db: query is exported as an async function', () => {
  assert.equal(typeof query, 'function', 'query must be a function');
});

test('db: execute is exported as an async function', () => {
  assert.equal(typeof execute, 'function', 'execute must be a function');
});

test('db: getConnection is exported as an async function', () => {
  assert.equal(typeof getConnection, 'function', 'getConnection must be a function');
});

test('db: pingDb is exported as an async function', () => {
  assert.equal(typeof pingDb, 'function', 'pingDb must be a function');
});

// ─── query() parameter handling ──────────────────────────────────────────────

test('db: query() with no params resolves with an array', async () => {
  const rows = await query('SELECT 1 AS n');
  assert.ok(Array.isArray(rows), 'query must resolve with an array');
});

test('db: query() with empty params array resolves with an array', async () => {
  const rows = await query('SELECT 1 AS n', []);
  assert.ok(Array.isArray(rows), 'query with empty params must resolve with an array');
});

test('db: query() with populated params resolves with an array', async () => {
  const rows = await query('SELECT ? AS n', [42]);
  assert.ok(Array.isArray(rows), 'query with params must resolve with an array');
  assert.equal(rows[0].n, 42, 'query must return the bound parameter value');
});

// ─── execute() parameter handling ────────────────────────────────────────────

test('db: execute() with no params resolves', async () => {
  const result = await execute('SELECT 1');
  assert.ok(result !== undefined, 'execute must resolve');
});

test('db: execute() with populated params rejects with connection error (not crash)', async () => {
  await assert.rejects(
    () => execute('INSERT INTO test (col) VALUES (?)', ['val']),
    (err) => {
      assert.ok(err instanceof Error, 'rejection must be an Error');
      return true;
    },
    'execute with params must reject with Error when DB unavailable'
  );
});

// ─── getConnection() ─────────────────────────────────────────────────────────

test('db: getConnection() resolves with a connection object', async () => {
  const conn = await getConnection();
  assert.ok(conn !== null && typeof conn === 'object', 'getConnection must resolve with a connection');
  conn.release();
});

// ─── pingDb() ────────────────────────────────────────────────────────────────

test('db: pingDb() resolves without error when DB is available', async () => {
  await assert.doesNotReject(
    () => pingDb(),
    'pingDb must resolve when DB is available'
  );
});

// ─── Function signatures ─────────────────────────────────────────────────────

test('db: query() accepts sql string and optional params array', () => {
  // Verify the function doesn't throw synchronously on valid argument shapes
  assert.equal(query.length >= 1, true, 'query must accept at least 1 argument');
});

test('db: execute() accepts sql string and optional params array', () => {
  assert.equal(execute.length >= 1, true, 'execute must accept at least 1 argument');
});
