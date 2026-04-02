<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-xl font-semibold">Audit Logs</h2>
      <div class="flex items-center gap-2">
        <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="exportLedger">Export Ledger</button>
        <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="purgeRetention">Purge >2y</button>
        <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="load(1)">Refresh</button>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <label class="text-sm">
        Action
        <input v-model.trim="filters.action" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">
        Actor Role
        <input v-model.trim="filters.actor_role" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">
        Target Table
        <input v-model.trim="filters.target_table" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
    </div>

    <button class="mt-3 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="load(1)">Apply Filters</button>

    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
    <p v-if="info" class="mt-2 text-sm text-emerald-700">{{ info }}</p>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-slate-50">
            <th class="border border-slate-200 px-2 py-2 text-left">Time</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Actor Role</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Action</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Target</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td class="border border-slate-200 px-2 py-2">{{ row.event_time }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ row.actor_role || '-' }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ row.action }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ row.target_table }} #{{ row.target_record_id || '-' }}</td>
            <td class="border border-slate-200 px-2 py-2"><pre class="whitespace-pre-wrap text-xs">{{ stringify(row.details) }}</pre></td>
          </tr>
          <tr v-if="!rows.length">
            <td class="border border-slate-200 px-2 py-3 text-center text-slate-500" colspan="5">No audit events found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" :disabled="page <= 1" @click="load(page - 1)">Prev</button>
      <span class="text-sm">Page {{ page }} / {{ totalPages }}</span>
      <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" :disabled="page >= totalPages" @click="load(page + 1)">Next</button>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { apiGet, apiPost } from '../services/api.js';

const props = defineProps({ token: { type: String, required: true } });

const rows = ref([]);
const error = ref('');
const info = ref('');
const page = ref(1);
const totalPages = ref(1);

const filters = reactive({
  action: '',
  actor_role: '',
  target_table: ''
});

function stringify(value) {
  if (!value) return '-';
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch (_e) {
    return String(value);
  }
}

function toQs() {
  const qs = new URLSearchParams();
  qs.set('page', String(page.value));
  qs.set('pageSize', '25');
  if (filters.action) qs.set('action', filters.action);
  if (filters.actor_role) qs.set('actor_role', filters.actor_role);
  if (filters.target_table) qs.set('target_table', filters.target_table);
  return qs.toString();
}

async function load(nextPage = page.value) {
  page.value = nextPage;
  error.value = '';
  info.value = '';
  try {
    const data = await apiGet(`/api/audit/events?${toQs()}`, props.token);
    rows.value = data.rows || [];
    page.value = data.pagination?.page || page.value;
    totalPages.value = data.pagination?.totalPages || 1;
  } catch (err) {
    error.value = err.message || 'Failed to load audit events';
  }
}

async function exportLedger() {
  error.value = '';
  info.value = '';
  try {
    const data = await apiPost('/api/audit/export', props.token, { output_dir: '/tmp' });
    info.value = `Exported ${data.exported || 0} rows to ${data.filePath || 'local file'}`;
  } catch (err) {
    error.value = err.message || 'Failed to export audit ledger';
  }
}

async function purgeRetention() {
  if (!confirm('Are you sure?')) return;
  error.value = '';
  info.value = '';
  try {
    const data = await apiPost('/api/audit/retention/purge', props.token, {});
    info.value = `Purged ${data.purged || 0} events older than ${data.retentionYears || 2} years`;
    await load(1);
  } catch (err) {
    error.value = err.message || 'Failed to purge retained events';
  }
}

onMounted(async () => {
  try {
    await load(1);
  } catch (err) {
    error.value = err.message || 'Failed to initialize audit logs';
  }
});
</script>
