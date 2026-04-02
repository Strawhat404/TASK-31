<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="text-xl font-semibold">Coordinator Scheduling</h2>

    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
    <p v-if="message" class="mt-3 text-sm text-slate-600">{{ message }}</p>

    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <label class="text-sm">Customer ID
        <input v-model.number="form.customer_id" type="number" min="1" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">Vehicle Type
        <select v-model="form.vehicle_type" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="light">Light</option>
          <option value="heavy_duty">Heavy Duty</option>
        </select>
      </label>
      <label class="text-sm">Scheduled At (UTC)
        <input v-model="form.scheduled_at" type="datetime-local" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">Notes
        <input v-model="form.notes" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
    </div>

    <button class="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed" :disabled="loading" @click="schedule">
      {{ loading ? 'Creating...' : 'Create Appointment' }}
    </button>

    <h3 class="mt-5 text-lg font-semibold">Waiting Room Seats</h3>
    <div class="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6 lg:grid-cols-8">
      <button
        v-for="seat in seats"
        :key="seat.id || seat.seat_label"
        class="rounded border px-2 py-2 text-left text-xs"
        :class="seat.occupied_by_appointment_id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-slate-50'"
        @click="assignSeat(seat)"
      >
        <strong>{{ seat.seat_label }}</strong>
        <span v-if="seat.occupied_by_appointment_id"> A#{{ seat.occupied_by_appointment_id }}</span>
      </button>
    </div>

    <label class="mt-3 block text-sm">Appointment For Seat Assignment
      <select v-model.number="selectedAppointmentId" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
        <option :value="0">Clear seat assignment</option>
        <option v-for="a in openAppointments" :key="a.id" :value="a.id">#{{ a.id }} | {{ a.status }}</option>
      </select>
    </label>

    <button class="mt-3 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed" :disabled="loading" @click="saveSeats">
      {{ loading ? 'Saving...' : 'Save Seat Layout' }}
    </button>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { apiGet, apiPost, apiPut } from '../services/api.js';

const props = defineProps({ token: { type: String, required: true } });

const message = ref('');
const error = ref('');
const loading = ref(false);
const form = reactive({
  customer_id: 1,
  vehicle_type: 'light',
  scheduled_at: '',
  notes: ''
});
const seats = ref([]);
const openAppointments = ref([]);
const selectedAppointmentId = ref(0);

function toUtcIso(localValue) {
  if (!localValue) return '';
  return new Date(localValue).toISOString();
}

async function refresh() {
  const [data, openApt] = await Promise.all([
    apiGet('/api/dashboard/coordinator-view', props.token),
    apiGet('/api/coordinator/open-appointments', props.token)
  ]);

  seats.value = (data.seats || []).map((s) => ({ ...s }));
  openAppointments.value = openApt.appointments || [];
}

async function schedule() {
  if (!confirm('Are you sure?')) return;

  message.value = '';
  error.value = '';
  loading.value = true;
  try {
    const payload = {
      customer_id: Number(form.customer_id),
      vehicle_type: form.vehicle_type,
      scheduled_at: toUtcIso(form.scheduled_at),
      notes: form.notes
    };

    const res = await apiPost('/api/coordinator/appointments/schedule', props.token, payload);
    message.value = `Scheduled appointment #${res.appointmentId}.`;
    await refresh();
  } catch (err) {
    error.value = err.message || 'Failed to schedule appointment';
  } finally {
    loading.value = false;
  }
}

async function assignSeat(seat) {
  error.value = '';
  loading.value = true;
  try {
    await apiPost('/api/coordinator/waiting-room/assign-seat', props.token, {
      seat_id: seat.id,
      appointment_id: selectedAppointmentId.value
    });
    await refresh();
  } catch (err) {
    error.value = err.message || 'Failed to assign seat';
  } finally {
    loading.value = false;
  }
}

async function saveSeats() {
  if (!confirm('Are you sure?')) return;

  error.value = '';
  loading.value = true;
  try {
    await apiPut('/api/coordinator/waiting-room/seats', props.token, { seats: seats.value });
    message.value = 'Seat layout saved';
  } catch (err) {
    error.value = err.message || 'Failed to save seat layout';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    await refresh();
  } catch (err) {
    error.value = err.message || 'Failed to load coordinator view';
  }
});
</script>
