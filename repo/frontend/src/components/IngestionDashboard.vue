<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="text-xl font-semibold">Data Ingestion Health</h2>

    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>

    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 class="text-sm font-semibold">Running</h3>
        <p class="mt-2 text-2xl font-bold">{{ statusCount('running') }}</p>
      </article>
      <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 class="text-sm font-semibold">Failed</h3>
        <p class="mt-2 text-2xl font-bold">{{ statusCount('failed') }}</p>
      </article>
      <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 class="text-sm font-semibold">Completed</h3>
        <p class="mt-2 text-2xl font-bold">{{ statusCount('completed') }}</p>
      </article>
    </div>

    <button class="mt-4 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="load">Refresh</button>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { fetchIngestionHealth } from '../services/api.js';

const props = defineProps({ token: { type: String, required: true } });

const statuses = ref([]);
const error = ref('');

function statusCount(name) {
  return Number(statuses.value.find((s) => s.status === name)?.count || 0);
}

async function load() {
  error.value = '';
  try {
    const data = await fetchIngestionHealth(props.token);
    statuses.value = data.statuses || [];
  } catch (err) {
    error.value = err.message || 'Failed to load ingestion health';
  }
}

onMounted(async () => {
  await load();
});
</script>
