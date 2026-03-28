import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as sched } from '../backend/src/services/schedulingService.js';

test('normalizeSlotStart accepts 30-min boundaries', () => {
  const d = sched.normalizeSlotStart('2026-03-26T10:30:00Z');
  assert.equal(d.getUTCMinutes(), 30);
});

test('normalizeSlotStart rejects non-30-min boundaries', () => {
  assert.throws(() => sched.normalizeSlotStart('2026-03-26T10:15:00Z'), /30-minute boundaries/);
});

test('heavy duty detection works', () => {
  assert.equal(sched.isHeavyVehicle('heavy_duty'), true);
  assert.equal(sched.isHeavyVehicle('light'), false);
});

test('bay metadata extractor works', () => {
  assert.equal(sched.getBayNumber('{"bayNumber":4}'), 4);
});
