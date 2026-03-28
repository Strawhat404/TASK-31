import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as sched } from '../backend/src/services/schedulingService.js';

test('enforces 30-minute slot boundaries', () => {
  const valid = sched.normalizeSlotStart('2026-03-26T10:30:10Z');
  assert.equal(valid.getUTCMinutes(), 30);
  assert.equal(valid.getUTCSeconds(), 0);

  assert.throws(
    () => sched.normalizeSlotStart('2026-03-26T10:15:00Z'),
    /30-minute boundaries/
  );
});

test('routes heavy-duty vehicles to bays 3-6', () => {
  const bays = [
    { id: 1, metadata: '{"bayNumber":1}' },
    { id: 2, metadata: '{"bayNumber":3}' },
    { id: 3, metadata: '{"bayNumber":6}' },
    { id: 4, metadata: '{"bayNumber":7}' }
  ];

  const heavy = sched.filterBayCandidates(bays, true).map((b) => b.id);
  const light = sched.filterBayCandidates(bays, false).map((b) => b.id);

  assert.deepEqual(heavy, [2, 3]);
  assert.deepEqual(light, [1, 2, 3, 4]);
});

test('creates recalibration window after every 8 tests', () => {
  assert.equal(sched.shouldScheduleRecalibration(7), false);
  assert.equal(sched.shouldScheduleRecalibration(8), true);

  const base = '2026-03-26T10:00:00Z';
  const window = sched.getRecalibrationWindow(base);

  assert.equal(window.start.toISOString(), '2026-03-26T10:30:00.000Z');
  assert.equal(window.end.toISOString(), '2026-03-26T10:45:00.000Z');
});
