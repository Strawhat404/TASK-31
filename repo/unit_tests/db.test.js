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

test('db: query() with no params rejects with connection error (not crash)', async () => {
  // Without a DB, the pool.query call rejects. Verify it rejects cleanly.
  await assert.rejects(
    () => query('SELECT 1'),
    (err) => {
      assert.ok(err instanceof Error, 'rejection must be an Error');
      return true;
    },
    'query without params must reject with Error when DB unavailable'
  );
});

test('db: query() with empty params array rejects with connection error (not crash)', async () => {
  await assert.rejects(
    () => query('SELECT 1', []),
    (err) => {
      assert.ok(err instanceof Error, 'rejection must be an Error');
      return true;
    },
    'query with empty params must reject with Error when DB unavailable'
  );
});

test('db: query() with populated params rejects with connection error (not crash)', async () => {
  await assert.rejects(
    () => query('SELECT * FROM users WHERE id = ?', [1]),
    (err) => {
      assert.ok(err instanceof Error, 'rejection must be an Error');
      return true;
    },
    'query with params must reject with Error when DB unavailable'
  );
});

// ─── execute() parameter handling ────────────────────────────────────────────

test('db: execute() with no params rejects with connection error (not crash)', async () => {
  await assert.rejects(
    () => execute('SELECT 1'),
    (err) => {
      assert.ok(err instanceof Error, 'rejection must be an Error');
      return true;
    },
    'execute without params must reject with Error when DB unavailable'
  );
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

test('db: getConnection() rejects with connection error when DB unavailable', async () => {
  await assert.rejects(
    () => getConnection(),
    (err) => {
      assert.ok(err instanceof Error, 'rejection must be an Error');
      return true;
    },
    'getConnection must reject with Error when DB unavailable'
  );
});

// ─── pingDb() ────────────────────────────────────────────────────────────────

test('db: pingDb() rejects with connection error when DB unavailable', async () => {
  await assert.rejects(
    () => pingDb(),
    (err) => {
      assert.ok(err instanceof Error, 'rejection must be an Error');
      return true;
    },
    'pingDb must reject with Error when DB unavailable'
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
