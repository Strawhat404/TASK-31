import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as ingest } from '../backend/src/services/ingestionService.js';
import { redactObject } from '../backend/src/utils/redaction.js';
import { encryptText, decryptText } from '../backend/src/utils/encryption.js';

test('redaction masks sensitive keys', () => {
  const inObj = { email: 'person@example.com', token: 'abc', nested: { vin: '123' }, plain: 'ok' };
  const out = redactObject(inObj);
  assert.equal(out.email, '***REDACTED***');
  assert.equal(out.token, '***REDACTED***');
  assert.equal(out.nested.vin, '***REDACTED***');
  assert.equal(out.plain, 'ok');
});

test('aes256 encryption round-trip', () => {
  const text = 'manual outbox payload';
  const enc = encryptText(text);
  const dec = decryptText(enc);
  assert.equal(dec, text);
});

test('normalization still converts miles and currency', () => {
  assert.equal(ingest.milesToKilometers(1), 1.6093);
  assert.equal(ingest.convertToUsd(10, 'KES'), 0.08);
});
