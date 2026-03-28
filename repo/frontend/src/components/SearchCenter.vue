<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="text-xl font-semibold">Search Intelligence</h2>

    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div class="lg:col-span-3">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      <label class="text-sm">Query
        <input v-model="filters.q" @input="loadAutocomplete" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Brand, model, plate" />
      </label>
      <label class="text-sm">Brand
        <input v-model="filters.brand" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">Energy Type
        <select v-model="filters.energy_type" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="">Any</option>
          <option value="petrol">Petrol</option>
          <option value="diesel">Diesel</option>
          <option value="hybrid">Hybrid</option>
          <option value="electric">Electric</option>
          <option value="cng">CNG</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="text-sm">Date From
        <input v-model="filters.date_from" type="date" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">Date To
        <input v-model="filters.date_to" type="date" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">Transmission
        <select v-model="filters.transmission" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="">Any</option>
          <option value="manual">Manual</option>
          <option value="automatic">Automatic</option>
          <option value="cvt">CVT</option>
          <option value="other">Other</option>
        </select>
      </label>
          <label class="text-sm">Model Year
            <input v-model.number="filters.model_year" type="number" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label class="text-sm">Price Min (USD)
            <input v-model.number="filters.price_min" type="number" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label class="text-sm">Price Max (USD)
            <input v-model.number="filters.price_max" type="number" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label class="text-sm">Sort By
            <select v-model="filters.sort_by" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="date">Date</option>
              <option value="status">Status</option>
            </select>
          </label>
          <label class="text-sm">Sort Order
            <select v-model="filters.sort_order" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
      </div>

      <aside class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 class="text-sm font-semibold">Trending Keywords (7d)</h3>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="item in trending"
            :key="item.keyword"
            class="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs"
            @click="applyKeyword(item.keyword)"
          >
            {{ item.keyword }} ({{ item.uses }})
          </button>
          <p v-if="!trending.length" class="text-xs text-slate-500">No trending data yet.</p>
        </div>
      </aside>
    </div>

    <button class="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" @click="search(1)">Search</button>

    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>

    <div v-if="autocomplete.length" class="mt-3 flex flex-wrap gap-2">
      <span class="text-sm font-medium">Autocomplete:</span>
      <button
        v-for="s in autocomplete"
        :key="s"
        class="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs"
        @click="applyKeyword(s)"
      >
        {{ s }}
      </button>
    </div>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-slate-50">
            <th class="border border-slate-200 px-2 py-2 text-left">Brand</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Model</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Year</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Price</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Energy</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Transmission</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="border border-slate-200 px-2 py-2">{{ r.brand }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ r.model_name }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ r.model_year }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ r.price_usd }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ r.energy_type }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ r.transmission }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" :disabled="page <= 1" @click="search(page - 1)">Prev</button>
      <span class="text-sm">Page {{ page }} / {{ totalPages }}</span>
      <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" :disabled="page >= totalPages" @click="search(page + 1)">Next</button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { apiGet } from '../services/api.js';

const props = defineProps({ token: { type: String, required: true } });

const filters = reactive({
  q: '',
  brand: '',
  model_year: null,
  price_min: null,
  price_max: null,
  energy_type: '',
  transmission: '',
  date_from: '',
  date_to: '',
  sort_by: 'date',
  sort_order: 'desc'
});

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const autocomplete = ref([]);
const trending = ref([]);
const error = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / 25)));

function toQs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== null && v !== undefined && String(v) !== '') p.set(k, String(v));
  });
  return p.toString();
}

async function loadAutocomplete() {
  if (!filters.q) {
    autocomplete.value = [];
    return;
  }

  try {
    const data = await apiGet(`/api/search/autocomplete?prefix=${encodeURIComponent(filters.q)}`, props.token);
    autocomplete.value = data.suggestions || [];
  } catch (err) {
    error.value = err.message || 'Autocomplete failed';
  }
}

function applyKeyword(keyword) {
  filters.q = keyword;
  search(1);
}

async function loadTrending() {
  const data = await apiGet('/api/search/trending', props.token);
  trending.value = data.keywords || [];
}

async function search(nextPage = 1) {
  page.value = nextPage;
  error.value = '';
  try {
    const qs = toQs({ ...filters, page: page.value });
    const data = await apiGet(`/api/search/vehicles?${qs}`, props.token);
    rows.value = data.rows || [];
    total.value = data.total || 0;
    await loadTrending();
  } catch (err) {
    error.value = err.message || 'Search failed';
  }
}

onMounted(async () => {
  try {
    await search(1);
  } catch (err) {
    error.value = err.message || 'Failed to load search view';
  }
});
</script>
