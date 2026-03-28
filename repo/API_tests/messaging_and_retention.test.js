import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as sched } from '../backend/src/services/schedulingService.js';
import { _testables as ingest } from '../backend/src/services/ingestionService.js';

test('heavy duty routing predicate remains strict', () => {
  assert.equal(sched.isHeavyVehicle('heavy_duty'), true);
  assert.equal(sched.isHeavyVehicle('HEAVY_DUTY'), true);
  assert.equal(sched.isHeavyVehicle('light'), false);
});

test('dedupe deterministic key and duplicate handling', () => {
  const row = {
    vehicle_plate: 'KCC111C',
    customer_id: '10',
    appointment_ts: '2026-03-01T00:00:00Z',
    location_code: 'HQ',
    department_code: 'OPS'
  };
  assert.equal(ingest.deterministicKey(row), ingest.deterministicKey(row));

  const out = ingest.dedupeRows([row, { ...row }]);
  assert.equal(out.duplicateCount, 1);
  assert.equal(out.rows.length, 1);
});
