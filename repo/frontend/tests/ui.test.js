import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

test('SearchCenter exposes model year, price band, sort and trending controls', () => {
  const source = fs.readFileSync(new URL('../src/components/SearchCenter.vue', import.meta.url), 'utf8');
  assert.match(source, /Model Year/);
  assert.match(source, /Price Min \(USD\)/);
  assert.match(source, /Price Max \(USD\)/);
  assert.match(source, /Sort By/);
  assert.match(source, /Sort Order/);
  assert.match(source, /Trending Keywords/);
});

test('frontend API client includes CSRF header with bearer token', () => {
  const source = fs.readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
  assert.match(source, /X-CSRF-Token/);
});
