<template>
  <div class="min-h-screen bg-slate-100">
    <LoginForm v-if="!state.user" @login="handleLogin" />

    <div v-else class="flex h-screen">
      <DashboardShell
        :user="state.user"
        :selected-view="state.currentView"
        @select-view="handleMenuSelect"
        @logout="handleLogout"
      />

      <main class="ml-72 flex-1 overflow-y-auto p-6">
        <section v-if="state.currentView === 'users' && state.user.role === 'Administrator'">
          <UserManagement :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'search'">
          <SearchCenter :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'coordinator'">
          <CoordinatorDashboard :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'ingestion'">
          <IngestionDashboard :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'messages'">
          <MessagingCenter :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'inspections'">
          <InspectorDashboard :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'customer'">
          <CustomerView :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'audit' && state.user.role === 'Administrator'">
          <AuditLogs :token="state.token" />
        </section>

        <section v-else>
          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 class="text-2xl font-bold">Welcome {{ state.user.role }}</h1>
            <p class="mt-2 text-sm text-slate-600">User: {{ state.user.fullName }}</p>
            <p class="text-sm text-slate-600">Scope: {{ state.user.locationCode }} / {{ state.user.departmentCode }}</p>

            <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 class="text-sm font-semibold">Today's Appointments</h3>
                <p class="mt-2 text-2xl font-bold">{{ state.summary?.metrics?.todays_appointments ?? 0 }}</p>
              </article>
              <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 class="text-sm font-semibold">Upcoming Appointments</h3>
                <p class="mt-2 text-2xl font-bold">{{ state.summary?.metrics?.upcoming_appointments ?? 0 }}</p>
              </article>
              <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 class="text-sm font-semibold">Total Inspections</h3>
                <p class="mt-2 text-2xl font-bold">{{ state.summary?.metrics?.total_inspections ?? 0 }}</p>
              </article>
              <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 class="text-sm font-semibold">Active Resources</h3>
                <p class="mt-2 text-2xl font-bold">{{ state.summary?.metrics?.active_resources ?? 0 }}</p>
              </article>
              <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 class="text-sm font-semibold">Ingestion Running</h3>
                <p class="mt-2 text-2xl font-bold">{{ state.summary?.metrics?.ingestion_running ?? 0 }}</p>
              </article>
              <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 class="text-sm font-semibold">Ingestion Failed</h3>
                <p class="mt-2 text-2xl font-bold">{{ state.summary?.metrics?.ingestion_failed ?? 0 }}</p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive } from 'vue';
import DashboardShell from './components/DashboardShell.vue';
import LoginForm from './components/LoginForm.vue';
import SearchCenter from './components/SearchCenter.vue';
import UserManagement from './components/UserManagement.vue';
import AuditLogs from './components/AuditLogs.vue';
import CoordinatorDashboard from './components/CoordinatorDashboard.vue';
import IngestionDashboard from './components/IngestionDashboard.vue';
import MessagingCenter from './components/MessagingCenter.vue';
import InspectorDashboard from './components/InspectorDashboard.vue';
import CustomerView from './components/CustomerView.vue';
import { fetchSummary, login, logout, me } from './services/api.js';

const STORAGE_KEY = 'roadsafe_session';

const state = reactive({
  token: '',
  user: null,
  summary: null,
  currentView: 'dashboard'
});

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: state.token }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  state.token = '';
  state.user = null;
  state.summary = null;
  state.currentView = 'dashboard';
}

async function loadSummary() {
  state.summary = await fetchSummary(state.token);
}

async function handleLogin(credentials) {
  const payload = await login(credentials.username, credentials.password);
  state.token = payload.token;
  state.user = payload.user;
  state.currentView = 'dashboard';
  saveSession();
  await loadSummary();
}

function handleMenuSelect(viewName) {
  const validViews = ['dashboard', 'users', 'search', 'coordinator', 'ingestion', 'messages', 'inspections', 'customer', 'audit'];
  const next = validViews.includes(viewName) ? viewName : 'dashboard';
  
  if ((next === 'users' || next === 'audit') && state.user?.role !== 'Administrator') {
    state.currentView = 'dashboard';
    return;
  }
  
  state.currentView = next;
}

async function handleLogout() {
  if (state.token) {
    try {
      await logout(state.token);
    } catch (_e) {
      // Ignore logout errors on expired sessions.
    }
  }
  clearSession();
}

onMounted(async () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.token = parsed.token || '';
    if (!state.token) return;

    const mePayload = await me(state.token);
    state.user = mePayload.user;
    state.currentView = 'dashboard';
    await loadSummary();
  } catch (_e) {
    clearSession();
  }
});
</script>
