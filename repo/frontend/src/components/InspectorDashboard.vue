<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="text-xl font-semibold">Inspector Dashboard</h2>
    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
    <p v-if="notice" class="mt-3 text-sm text-slate-600">{{ notice }}</p>

    <button class="mt-3 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="loadQueue">Refresh Queue</button>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-slate-50">
            <th class="border border-slate-200 px-2 py-2 text-left">Appointment</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Scheduled</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Vehicle</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in queueRows" :key="row.id">
            <td class="border border-slate-200 px-2 py-2">#{{ row.id }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ row.scheduled_at }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ row.brand }} {{ row.model_name }} ({{ row.plate_number }})</td>
            <td class="border border-slate-200 px-2 py-2">
              <button class="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs" @click="openPublish(row)">Publish Result</button>
            </td>
          </tr>
          <tr v-if="!queueRows.length">
            <td colspan="4" class="border border-slate-200 px-2 py-3 text-center text-slate-500">No assigned appointments.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="publishModal.open" class="fixed inset-0 z-50 grid place-items-center bg-overlay p-4" @click.self="closePublish">
      <div class="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
        <h3 class="text-lg font-semibold">Publish Inspection Result</h3>
        <p class="mt-1 text-sm text-slate-600">Appointment #{{ publishModal.appointment_id }}</p>

        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label class="text-sm">Outcome
            <select v-model="publishModal.outcome" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="recheck_required">Recheck Required</option>
            </select>
          </label>
          <label class="text-sm">Score
            <input v-model.number="publishModal.score" type="number" min="0" max="100" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
        </div>

        <label class="mt-3 block text-sm">Findings (JSON)
          <textarea v-model="publishModal.findingsText" rows="5" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"></textarea>
        </label>

        <p v-if="publishModal.error" class="mt-2 text-sm text-red-600">{{ publishModal.error }}</p>

        <div class="mt-4 flex justify-end gap-2">
          <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="closePublish">Cancel</button>
          <button class="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" @click="publishResult">Publish</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { apiGet, apiPost } from '../services/api.js';

const props = defineProps({ token: { type: String, required: true } });

const queueRows = ref([]);
const error = ref('');
const notice = ref('');
const publishModal = reactive({
  open: false,
  appointment_id: 0,
  outcome: 'pass',
  score: 85,
  findingsText: '{\n  "notes": ""\n}',
  error: ''
});

async function loadQueue() {
  error.value = '';
  const data = await apiGet('/api/inspections/queue', props.token);
  queueRows.value = data.rows || [];
}

function openPublish(row) {
  publishModal.open = true;
  publishModal.appointment_id = row.id;
  publishModal.outcome = 'pass';
  publishModal.score = 85;
  publishModal.findingsText = '{\n  "notes": ""\n}';
  publishModal.error = '';
}

function closePublish() {
  publishModal.open = false;
}

async function publishResult() {
  publishModal.error = '';
  try {
    const findings = JSON.parse(publishModal.findingsText || '{}');
    await apiPost('/api/inspections/results', props.token, {
      appointment_id: publishModal.appointment_id,
      outcome: publishModal.outcome,
      score: publishModal.score,
      findings
    });
    notice.value = `Inspection result published for appointment #${publishModal.appointment_id}.`;
    closePublish();
    await loadQueue();
  } catch (err) {
    publishModal.error = err.message || 'Failed to publish inspection result';
  }
}

onMounted(async () => {
  try {
    await loadQueue();
  } catch (err) {
    error.value = err.message || 'Failed to load inspection queue';
  }
});
</script>
