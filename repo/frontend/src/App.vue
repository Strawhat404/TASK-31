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

        <section v-else-if="state.currentView === 'coordinator' && ['Administrator', 'Coordinator'].includes(state.user.role)">
          <CoordinatorDashboard :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'ingestion' && ['Administrator', 'Data Engineer'].includes(state.user.role)">
          <IngestionDashboard :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'messages' && ['Administrator', 'Coordinator', 'Data Engineer', 'Inspector'].includes(state.user.role)">
          <MessagingCenter :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'inspections' && ['Administrator', 'Inspector'].includes(state.user.role)">
          <InspectorDashboard :token="state.token" />
        </section>

        <section v-else-if="state.currentView === 'customer' && ['Administrator', 'Customer'].includes(state.user.role)">
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

            <!-- Today's Appointments List -->
            <div v-if="state.summary?.todaysAppointments?.length" class="mt-6">
              <h2 class="text-lg font-semibold mb-3">Today's Appointments</h2>
              <div class="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <table class="min-w-full divide-y divide-slate-200">
                  <thead class="bg-slate-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vehicle Type</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200">
                    <tr v-for="apt in state.summary.todaysAppointments" :key="apt.id">
                      <td class="px-4 py-3 text-sm">{{ formatTime(apt.scheduled_at) }}</td>
                      <td class="px-4 py-3 text-sm">{{ apt.customer_name || 'N/A' }}</td>
                      <td class="px-4 py-3 text-sm">
                        <span :class="statusClass(apt.status)">{{ apt.status }}</span>
                      </td>
                      <td class="px-4 py-3 text-sm">{{ apt.vehicle_type || 'N/A' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Resource Utilization -->
            <div v-if="state.summary?.resourceUtilization" class="mt-6">
              <h2 class="text-lg font-semibold mb-3">Resource Utilization</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 class="text-sm font-medium text-slate-700">Inspection Bays</h3>
                  <div class="mt-2">
                    <div class="flex justify-between text-sm mb-1">
                      <span>{{ state.summary.resourceUtilization.bays_in_use }} / {{ state.summary.resourceUtilization.total_bays }} in use</span>
                      <span>{{ bayUtilizationPercent }}%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2">
                      <div class="bg-blue-600 h-2 rounded-full" :style="{ width: bayUtilizationPercent + '%' }"></div>
                    </div>
                  </div>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 class="text-sm font-medium text-slate-700">Equipment</h3>
                  <div class="mt-2">
                    <div class="flex justify-between text-sm mb-1">
                      <span>{{ state.summary.resourceUtilization.equipment_in_use }} / {{ state.summary.resourceUtilization.total_equipment }} in use</span>
                      <span>{{ equipmentUtilizationPercent }}%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2">
                      <div class="bg-green-600 h-2 rounded-full" :style="{ width: equipmentUtilizationPercent + '%' }"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Ingestion Job Health -->
            <div v-if="state.summary?.ingestionHealth" class="mt-6">
              <h2 class="text-lg font-semibold mb-3">Ingestion Job Health</h2>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 class="text-sm font-medium text-slate-700">Queued</h3>
                  <p class="mt-2 text-2xl font-bold text-slate-600">{{ state.summary.ingestionHealth.queued ?? 0 }}</p>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 class="text-sm font-medium text-slate-700">Running</h3>
                  <p class="mt-2 text-2xl font-bold text-blue-600">{{ state.summary.ingestionHealth.running ?? 0 }}</p>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 class="text-sm font-medium text-slate-700">Failed (24h)</h3>
                  <p class="mt-2 text-2xl font-bold text-red-600">{{ state.summary.ingestionHealth.failed_24h ?? 0 }}</p>
                </div>
              </div>
              <div v-if="state.summary.ingestionHealth.recent_jobs?.length" class="mt-4 rounded-lg border border-slate-200 bg-white overflow-hidden">
                <table class="min-w-full divide-y divide-slate-200">
                  <thead class="bg-slate-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Job Type</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Started</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200">
                    <tr v-for="job in state.summary.ingestionHealth.recent_jobs" :key="job.id">
                      <td class="px-4 py-3 text-sm">{{ job.job_type }}</td>
                      <td class="px-4 py-3 text-sm">
                        <span :class="jobStatusClass(job.status)">{{ job.status }}</span>
                      </td>
                      <td class="px-4 py-3 text-sm">{{ formatTime(job.started_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, computed } from 'vue';
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

const bayUtilizationPercent = computed(() => {
  const util = state.summary?.resourceUtilization;
  if (!util || !util.total_bays) return 0;
  return Math.round((util.bays_in_use / util.total_bays) * 100);
});

const equipmentUtilizationPercent = computed(() => {
  const util = state.summary?.resourceUtilization;
  if (!util || !util.total_equipment) return 0;
  return Math.round((util.equipment_in_use / util.total_equipment) * 100);
});

function formatTime(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function statusClass(status) {
  const classes = {
    scheduled: 'px-2 py-1 text-xs rounded bg-blue-100 text-blue-800',
    checked_in: 'px-2 py-1 text-xs rounded bg-green-100 text-green-800',
    completed: 'px-2 py-1 text-xs rounded bg-slate-100 text-slate-800',
    cancelled: 'px-2 py-1 text-xs rounded bg-red-100 text-red-800'
  };
  return classes[status] || 'px-2 py-1 text-xs rounded bg-slate-100 text-slate-800';
}

function jobStatusClass(status) {
  const classes = {
    queued: 'px-2 py-1 text-xs rounded bg-slate-100 text-slate-800',
    running: 'px-2 py-1 text-xs rounded bg-blue-100 text-blue-800',
    completed: 'px-2 py-1 text-xs rounded bg-green-100 text-green-800',
    failed: 'px-2 py-1 text-xs rounded bg-red-100 text-red-800'
  };
  return classes[status] || 'px-2 py-1 text-xs rounded bg-slate-100 text-slate-800';
}

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
  
  const role = state.user?.role;
  
  // Role-based view access control
  const roleViewMap = {
    'Administrator': ['dashboard', 'users', 'search', 'coordinator', 'ingestion', 'messages', 'audit'],
    'Coordinator': ['dashboard', 'search', 'coordinator', 'messages'],
    'Data Engineer': ['dashboard', 'search', 'ingestion', 'messages'],
    'Inspector': ['dashboard', 'search', 'inspections', 'messages'],
    'Customer': ['dashboard', 'search', 'customer']
  };
  
  const allowedViews = roleViewMap[role] || ['dashboard', 'search'];
  
  if (!allowedViews.includes(next)) {
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
