<template>
  <aside class="fixed left-0 top-0 h-screen w-72 border-r border-slate-200 bg-white p-4">
    <h2 class="text-xl font-semibold">Operations Menu</h2>
    <p class="mt-2 text-sm text-slate-600">Role: <strong>{{ user.role }}</strong></p>

    <ul class="list-none p-0 mt-4 space-y-2">
      <li v-for="item in menuItems" :key="item.key">
        <button
          class="w-full rounded-md border px-3 py-2 text-left text-sm"
          :class="selectedView === item.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300'"
          @click="$emit('select-view', item.key)"
        >
          {{ item.label }}
        </button>
      </li>
    </ul>

    <button class="mt-4 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="$emit('logout')">
      Sign Out
    </button>
  </aside>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  user: { type: Object, required: true },
  selectedView: { type: String, required: false, default: 'dashboard' }
});

defineEmits(['logout', 'select-view']);

const menuItems = computed(() => {
  const baseItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'search', label: 'Search' }
  ];

  const role = props.user.role;

  if (role === 'Administrator') {
    return [
      ...baseItems,
      { key: 'coordinator', label: 'Coordinator' },
      { key: 'ingestion', label: 'Data Ingestion' },
      { key: 'messages', label: 'Messages' },
      { key: 'users', label: 'User Management' },
      { key: 'audit', label: 'Audit Logs' }
    ];
  }

  if (role === 'Coordinator') {
    return [
      ...baseItems,
      { key: 'coordinator', label: 'Scheduling' },
      { key: 'messages', label: 'Messages' }
    ];
  }

  if (role === 'Data Engineer') {
    return [
      ...baseItems,
      { key: 'ingestion', label: 'Data Ingestion' },
      { key: 'messages', label: 'Messages' }
    ];
  }

  if (role === 'Inspector') {
    return [
      ...baseItems,
      { key: 'inspections', label: 'Inspections' },
      { key: 'messages', label: 'Messages' }
    ];
  }

  if (role === 'Customer') {
    return [
      ...baseItems,
      { key: 'customer', label: 'My Reports' }
    ];
  }

  return baseItems;
});
</script>
