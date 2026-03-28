import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as ingest } from '../backend/src/services/ingestionService.js';

test('miles to kilometers normalization', () => {
  assert.equal(ingest.milesToKilometers(10), 16.0934);
});

test('currency conversion to USD', () => {
  assert.equal(ingest.convertToUsd(100, 'EUR'), 108);
  assert.equal(ingest.convertToUsd(1000, 'KES'), 7.8);
});

test('deterministic key remains stable', () => {
  const row = {
    vehicle_plate: 'KAA123A',
    customer_id: '42',
    appointment_ts: '2026-03-26T10:00:00Z',
    location_code: 'HQ',
    department_code: 'OPS'
  };
  assert.equal(ingest.deterministicKey(row), ingest.deterministicKey(row));
});

test('dedupe removes similar duplicates', () => {
  const rows = [
    {
      vehicle_plate: 'KAA123A',
      customer_id: '42',
      appointment_ts: '2026-03-26T10:00:00Z',
      location_code: 'HQ',
      department_code: 'OPS'
    },
    {
      vehicle_plate: 'KAA123A',
      customer_id: '42',
      appointment_ts: '2026-03-26T10:00:00Z',
      location_code: 'HQ',
      department_code: 'OPS'
    }
  ];

  const out = ingest.dedupeRows(rows);
  assert.equal(out.rows.length, 1);
  assert.equal(out.duplicateCount, 1);
});
