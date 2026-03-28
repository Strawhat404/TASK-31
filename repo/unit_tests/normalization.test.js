import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as ingest } from '../backend/src/services/ingestionService.js';

test('converts miles to km with stable precision', () => {
  assert.equal(ingest.milesToKilometers(1), 1.6093);
  assert.equal(ingest.milesToKilometers(10), 16.0934);
});

test('converts currencies to USD using configured FX table', () => {
  assert.equal(ingest.convertToUsd(100, 'EUR'), 108);
  assert.equal(ingest.convertToUsd(1000, 'KES'), 7.8);
  assert.equal(ingest.convertToUsd(50, 'USD'), 50);
});

test('deterministic dedupe key is stable and input-sensitive', () => {
  const rowA = {
    vehicle_plate: 'KAA123A',
    customer_id: '42',
    appointment_ts: '2026-03-26T10:00:00Z',
    location_code: 'HQ',
    department_code: 'OPS'
  };

  const rowB = { ...rowA };
  const rowC = { ...rowA, vehicle_plate: 'KAA124A' };

  assert.equal(ingest.deterministicKey(rowA), ingest.deterministicKey(rowB));
  assert.notEqual(ingest.deterministicKey(rowA), ingest.deterministicKey(rowC));
});
