import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as ingest } from '../backend/src/services/ingestionService.js';

test('picks queued jobs by priority then created_at', () => {
  const jobs = [
    { id: 1, status: 'queued', payload: { priority: 20 }, created_at: '2026-03-27T10:00:00Z' },
    { id: 2, status: 'running', payload: { priority: 1 }, created_at: '2026-03-27T09:00:00Z' },
    { id: 3, status: 'queued', payload: { priority: 10 }, created_at: '2026-03-27T11:00:00Z' },
    { id: 4, status: 'queued', payload: { priority: 10 }, created_at: '2026-03-27T08:00:00Z' }
  ];

  const picked = ingest.pickJobByPriority(jobs);
  assert.equal(picked.id, 4);
});

test('applies exponential retry backoff and fails after max retries', () => {
  const r1 = ingest.computeRetryState({ retries: 0 });
  const r5 = ingest.computeRetryState({ retries: 4 });
  const r6 = ingest.computeRetryState({ retries: 5 });

  assert.deepEqual(r1, { retries: 1, shouldFail: false, retryAfterMs: 2000 });
  assert.deepEqual(r5, { retries: 5, shouldFail: false, retryAfterMs: 32000 });
  assert.equal(r6.shouldFail, true);
  assert.equal(r6.retryAfterMs, 0);
  assert.equal(r6.retries, ingest.MAX_RETRIES + 1);
});

test('builds checkpoint snapshot with last_processed_row', () => {
  const snapshot = ingest.buildCheckpointSnapshot({
    parsedRows: 120,
    writtenRows: 115,
    versionNo: 7
  });

  assert.equal(snapshot.rows_parsed, 120);
  assert.equal(snapshot.rows_written, 115);
  assert.equal(snapshot.dataset_version, 7);
  assert.equal(snapshot.last_processed_row, 120);
});
