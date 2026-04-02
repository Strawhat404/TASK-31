<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="text-xl font-semibold">Messaging Center</h2>

    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>

    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <label class="text-sm">Recipient User ID
        <input v-model.number="compose.recipient_user_id" type="number" min="1" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">Type
        <select v-model="compose.message_type" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="appointment_confirmation">Appointment Confirmation</option>
          <option value="report_announcement">Report Announcement</option>
          <option value="system_notice">System Notice</option>
        </select>
      </label>
      <label class="text-sm">Subject
        <input v-model="compose.subject" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
    </div>

    <label class="mt-3 block text-sm">Body
      <textarea v-model="compose.body" rows="3" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"></textarea>
    </label>

    <button class="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed" :disabled="loading" @click="send">
      {{ loading ? 'Sending...' : 'Queue Message' }}
    </button>

    <h3 class="mt-5 text-lg font-semibold">Inbox</h3>
    <div class="mt-2 overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead><tr class="bg-slate-50"><th class="border border-slate-200 px-2 py-2 text-left">Type</th><th class="border border-slate-200 px-2 py-2 text-left">Subject</th><th class="border border-slate-200 px-2 py-2 text-left">Body</th></tr></thead>
        <tbody>
          <tr v-if="!loadingInbox && inboxRows.length === 0">
            <td colspan="3" class="border border-slate-200 px-2 py-4 text-center text-sm text-slate-500">
              No messages in your inbox.
            </td>
          </tr>
          <tr v-else-if="loadingInbox">
            <td colspan="3" class="border border-slate-200 px-2 py-4 text-center text-sm text-slate-500">
              Loading...
            </td>
          </tr>
          <tr v-for="m in inboxRows" :key="m.id">
            <td class="border border-slate-200 px-2 py-2">{{ m.message_type }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ m.subject }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ m.body }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button class="mt-4 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed" :disabled="loadingExport" @click="exportOutbox">
      {{ loadingExport ? 'Exporting...' : 'Export Manual Outbox' }}
    </button>
    <p v-if="outboxNotice" class="mt-2 text-sm text-slate-600">{{ outboxNotice }}</p>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { apiGet, apiPost } from '../services/api.js';

const props = defineProps({ token: { type: String, required: true } });

const compose = reactive({
  recipient_user_id: 1,
  message_type: 'appointment_confirmation',
  subject: 'RoadSafe Notification',
  body: '',
  channels: ['sms']
});

const inboxRows = ref([]);
const outboxNotice = ref('');
const error = ref('');
const loading = ref(false);
const loadingInbox = ref(false);
const loadingExport = ref(false);

async function loadInbox() {
  loadingInbox.value = true;
  try {
    const data = await apiGet('/api/messages/inbox', props.token);
    inboxRows.value = data.messages || [];
  } finally {
    loadingInbox.value = false;
  }
}

async function send() {
  if (!confirm('Are you sure?')) return;

  error.value = '';
  loading.value = true;
  try {
    await apiPost('/api/messages/send', props.token, compose);
    compose.body = '';
    await loadInbox();
  } catch (err) {
    error.value = err.message || 'Failed to send message';
  } finally {
    loading.value = false;
  }
}

async function exportOutbox() {
  if (!confirm('Are you sure?')) return;

  error.value = '';
  loadingExport.value = true;
  try {
    const data = await apiPost('/api/messages/outbox/export', props.token, {});
    outboxNotice.value = `Exported ${data.exported} payload(s).`;
  } catch (err) {
    error.value = err.message || 'Failed to export outbox';
  } finally {
    loadingExport.value = false;
  }
}

onMounted(async () => {
  try {
    await loadInbox();
  } catch (err) {
    error.value = err.message || 'Failed to load messaging view';
  }
});
</script>
