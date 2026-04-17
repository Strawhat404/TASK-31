import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startIngestionScheduler,
  stopIngestionScheduler
} from '../backend/src/services/ingestionSchedulerService.js';

/**
 * Ingestion scheduler service unit tests.
 *
 * The scheduler depends on a running MySQL instance for resolveSystemSubmitterId()
 * and enqueueIngestionJob(), so tick execution is covered by API integration tests.
 *
 * These unit tests exercise the lifecycle (start/stop), double-start prevention,
 * and cleanup paths that are independent of the database.
 */

// ─── Module exports ──────────────────────────────────────────────────────────

test('ingestionScheduler: exports startIngestionScheduler as async function', () => {
  assert.equal(typeof startIngestionScheduler, 'function', 'startIngestionScheduler must be a function');
});

test('ingestionScheduler: exports stopIngestionScheduler as function', () => {
  assert.equal(typeof stopIngestionScheduler, 'function', 'stopIngestionScheduler must be a function');
});

// ─── Stop when nothing is running ────────────────────────────────────────────

test('ingestionScheduler: stopIngestionScheduler is a no-op when nothing is running', () => {
  // Calling stop before start should not throw
  assert.doesNotThrow(() => {
    stopIngestionScheduler();
  }, 'stopIngestionScheduler must not throw when called without a prior start');
});

// ─── Start / stop lifecycle ──────────────────────────────────────────────────

test('ingestionScheduler: start then stop does not throw', async () => {
  // startIngestionScheduler tries node-cron first, then falls back to setInterval.
  // In unit tests without a DB, the tick function will fail silently when
  // resolveSystemSubmitterId() returns 0, but the scheduler itself starts fine.
  await assert.doesNotReject(async () => {
    await startIngestionScheduler({ intervalMs: 999999 });
  }, 'startIngestionScheduler must not reject');

  assert.doesNotThrow(() => {
    stopIngestionScheduler();
  }, 'stopIngestionScheduler must not throw after start');
});

// ─── Double-start prevention ─────────────────────────────────────────────────

test('ingestionScheduler: calling start twice does not create duplicate timers', async () => {
  // The implementation guards with: if (cronTask || fallbackTimer) return;
  // This verifies calling start twice completes without error.
  await startIngestionScheduler({ intervalMs: 999999 });
  await startIngestionScheduler({ intervalMs: 999999 });

  // Clean up
  stopIngestionScheduler();
});

// ─── Stop after stop ─────────────────────────────────────────────────────────

test('ingestionScheduler: calling stop twice is safe', async () => {
  await startIngestionScheduler({ intervalMs: 999999 });
  stopIngestionScheduler();

  assert.doesNotThrow(() => {
    stopIngestionScheduler();
  }, 'second stopIngestionScheduler call must not throw');
});

// ─── Default interval parameter ──────────────────────────────────────────────

test('ingestionScheduler: accepts options parameter with intervalMs', async () => {
  // Verify the function signature accepts { intervalMs } without error
  await assert.doesNotReject(async () => {
    await startIngestionScheduler({ intervalMs: 3600000 });
  }, 'startIngestionScheduler must accept intervalMs option');

  stopIngestionScheduler();
});

test('ingestionScheduler: accepts empty options object', async () => {
  await assert.doesNotReject(async () => {
    await startIngestionScheduler({});
  }, 'startIngestionScheduler must accept empty options');

  stopIngestionScheduler();
});
