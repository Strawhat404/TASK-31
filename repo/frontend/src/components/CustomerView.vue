<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="text-xl font-semibold">Customer Portal</h2>
    <p class="mt-1 text-sm text-slate-600">Your eligible vehicles and published reports</p>
    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>

    <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 class="text-sm font-semibold">My Vehicles</h3>
        <div class="mt-2 overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="bg-white">
                <th class="border border-slate-200 px-2 py-2 text-left">Plate</th>
                <th class="border border-slate-200 px-2 py-2 text-left">Brand</th>
                <th class="border border-slate-200 px-2 py-2 text-left">Model</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in vehicles" :key="v.id">
                <td class="border border-slate-200 px-2 py-2">{{ v.plate_number }}</td>
                <td class="border border-slate-200 px-2 py-2">{{ v.brand }}</td>
                <td class="border border-slate-200 px-2 py-2">{{ v.model_name }}</td>
              </tr>
              <tr v-if="!vehicles.length">
                <td colspan="3" class="border border-slate-200 px-2 py-3 text-center text-slate-500">No vehicles found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 class="text-sm font-semibold">My Inspection Reports</h3>
        <div class="mt-2 overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="bg-white">
                <th class="border border-slate-200 px-2 py-2 text-left">Report</th>
                <th class="border border-slate-200 px-2 py-2 text-left">Outcome</th>
                <th class="border border-slate-200 px-2 py-2 text-left">Completed</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in reports" :key="r.report_id">
                <td class="border border-slate-200 px-2 py-2">#{{ r.report_id }}</td>
                <td class="border border-slate-200 px-2 py-2">{{ r.outcome }}</td>
                <td class="border border-slate-200 px-2 py-2">{{ r.completed_at }}</td>
              </tr>
              <tr v-if="!reports.length">
                <td colspan="3" class="border border-slate-200 px-2 py-3 text-center text-slate-500">No reports published yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { apiGet } from '../services/api.js';

const props = defineProps({ token: { type: String, required: true } });

const vehicles = ref([]);
const reports = ref([]);
const error = ref('');

async function loadData() {
  error.value = '';
  const [vehicleData, reportData] = await Promise.all([
    apiGet('/api/search/vehicles?page=1&sort_by=date&sort_order=desc', props.token),
    apiGet('/api/inspections/customer/reports', props.token)
  ]);
  vehicles.value = vehicleData.rows || [];
  reports.value = reportData.rows || [];
}

onMounted(async () => {
  try {
    await loadData();
  } catch (err) {
    error.value = err.message || 'Failed to load customer portal';
  }
});
</script>
