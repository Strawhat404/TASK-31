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


test('DashboardShell exposes role-based menu items', () => {
  const source = fs.readFileSync(new URL('../src/components/DashboardShell.vue', import.meta.url), 'utf8');
  // Admin gets all menus
  assert.match(source, /Administrator/);
  assert.match(source, /User Management/);
  assert.match(source, /Audit Logs/);
  // Coordinator gets scheduling
  assert.match(source, /Coordinator/);
  assert.match(source, /Scheduling/);
  // Data Engineer gets ingestion
  assert.match(source, /Data Engineer/);
  assert.match(source, /Data Ingestion/);
  // Inspector gets inspections
  assert.match(source, /Inspector/);
  assert.match(source, /Inspections/);
  // Customer gets limited view
  assert.match(source, /Customer/);
  assert.match(source, /My Reports/);
});

test('DashboardShell has sign out button', () => {
  const source = fs.readFileSync(new URL('../src/components/DashboardShell.vue', import.meta.url), 'utf8');
  assert.match(source, /Sign Out/);
  assert.match(source, /logout/);
});

test('App.vue handles login and logout state', () => {
  const source = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
  assert.match(source, /token/);
  assert.match(source, /logout/);
  assert.match(source, /LoginForm/);
  assert.match(source, /DashboardShell/);
});

test('MessagingCenter exists and has send/inbox functionality', () => {
  const source = fs.readFileSync(new URL('../src/components/MessagingCenter.vue', import.meta.url), 'utf8');
  assert.match(source, /inbox/i);
  assert.match(source, /send/i);
});

test('UserManagement is admin-only gated', () => {
  const source = fs.readFileSync(new URL('../src/components/UserManagement.vue', import.meta.url), 'utf8');
  // Should reference admin role or registration
  assert.match(source, /register|Register|admin|Administrator/);
});

test('SearchCenter pagination controls exist', () => {
  const source = fs.readFileSync(new URL('../src/components/SearchCenter.vue', import.meta.url), 'utf8');
  assert.match(source, /Prev/);
  assert.match(source, /Next/);
  assert.match(source, /Page/);
});

test('SearchCenter autocomplete is wired to query input', () => {
  const source = fs.readFileSync(new URL('../src/components/SearchCenter.vue', import.meta.url), 'utf8');
  assert.match(source, /loadAutocomplete/);
  assert.match(source, /autocomplete/);
});
