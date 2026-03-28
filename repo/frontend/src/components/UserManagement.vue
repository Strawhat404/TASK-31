<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-xl font-semibold">User Management</h2>
      <button class="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" @click="openAddModal">Add User</button>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <label class="text-sm">Search
        <input v-model.trim="filters.q" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="text-sm">Role
        <select v-model="filters.role" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="">All</option>
          <option v-for="role in roles" :key="role.id" :value="role.name">{{ role.name }}</option>
        </select>
      </label>
      <label class="text-sm">Status
        <select v-model="filters.status" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="">All</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </label>
    </div>

    <button class="mt-3 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="loadUsers(1)">Apply Filters</button>

    <p v-if="notice" class="mt-3 text-sm text-slate-600">{{ notice }}</p>
    <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-slate-50">
            <th class="border border-slate-200 px-2 py-2 text-left">Username</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Role</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Location</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Department</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Status</th>
            <th class="border border-slate-200 px-2 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td class="border border-slate-200 px-2 py-2">{{ user.username }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ user.role }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ user.location_code }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ user.department_code }}</td>
            <td class="border border-slate-200 px-2 py-2">{{ user.status }}</td>
            <td class="border border-slate-200 px-2 py-2">
              <div class="flex flex-wrap gap-2">
                <button class="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs" @click="openEditModal(user)">Edit</button>
                <button class="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs" @click="toggleActive(user)">
                  {{ user.is_active ? 'Deactivate' : 'Activate' }}
                </button>
                <button class="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs" @click="openResetModal(user)">Reset Password</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" :disabled="pagination.page <= 1" @click="loadUsers(pagination.page - 1)">Prev</button>
      <span class="text-sm">Page {{ pagination.page }} / {{ pagination.totalPages }}</span>
      <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" :disabled="pagination.page >= pagination.totalPages" @click="loadUsers(pagination.page + 1)">Next</button>
    </div>

    <div v-if="modals.add || modals.edit || modals.reset" class="fixed inset-0 z-50 grid place-items-center bg-overlay p-4" @click.self="closeModals">
      <div class="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
        <h3 v-if="modals.add" class="text-lg font-semibold">Add User</h3>
        <h3 v-if="modals.edit" class="text-lg font-semibold">Edit User</h3>
        <h3 v-if="modals.reset" class="text-lg font-semibold">Reset Password</h3>

        <div v-if="modals.add" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input v-model.trim="addForm.username" placeholder="Username" class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input v-model.trim="addForm.full_name" placeholder="Full Name" class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input v-model.trim="addForm.email" placeholder="Email" class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select v-model="addForm.role_name" class="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option disabled value="">Select role</option>
            <option v-for="role in roles" :key="role.id" :value="role.name">{{ role.name }}</option>
          </select>
          <input v-model.trim="addForm.location_code" placeholder="Location" class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input v-model.trim="addForm.department_code" placeholder="Department" class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input v-model="addForm.password" type="password" placeholder="Temporary Password" class="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
        </div>

        <div v-if="modals.edit" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select v-model="editForm.role_name" class="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option v-for="role in roles" :key="role.id" :value="role.name">{{ role.name }}</option>
          </select>
          <select v-model="editForm.status" class="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <input v-model.trim="editForm.location_code" placeholder="Location" class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input v-model.trim="editForm.department_code" placeholder="Department" class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div v-if="modals.reset" class="mt-3">
          <input v-model="resetForm.password" type="password" placeholder="New Password" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <p v-if="modalError" class="mt-3 text-sm text-red-600">{{ modalError }}</p>

        <div class="mt-4 flex justify-end gap-2">
          <button class="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm" @click="closeModals">Cancel</button>
          <button v-if="modals.add" class="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" @click="submitAddUser">Create</button>
          <button v-if="modals.edit" class="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" @click="submitEditUser">Save</button>
          <button v-if="modals.reset" class="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" @click="submitResetPassword">Reset</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { apiGet, apiPost, apiPut } from '../services/api.js';

const props = defineProps({ token: { type: String, required: true } });

const users = ref([]);
const roles = ref([]);
const error = ref('');
const notice = ref('');
const modalError = ref('');

const pagination = reactive({ page: 1, pageSize: 25, totalPages: 1, total: 0 });
const filters = reactive({ q: '', role: '', location: '', department: '', status: '' });
const modals = reactive({ add: false, edit: false, reset: false });

const addForm = reactive({
  username: '', full_name: '', email: '', password: '', role_name: '', location_code: '', department_code: ''
});

const editForm = reactive({ id: 0, username: '', role_name: '', location_code: '', department_code: '', status: 'Active' });
const resetForm = reactive({ id: 0, username: '', password: '' });

function passwordComplexEnough(password) {
  if (typeof password !== 'string' || password.length < 12) return false;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function toQuery() {
  const params = new URLSearchParams();
  params.set('page', String(pagination.page));
  params.set('pageSize', String(pagination.pageSize));
  if (filters.q) params.set('q', filters.q);
  if (filters.role) params.set('role', filters.role);
  if (filters.location) params.set('location', filters.location);
  if (filters.department) params.set('department', filters.department);
  if (filters.status) params.set('status', filters.status);
  return params.toString();
}

async function loadRoles() {
  const data = await apiGet('/api/roles', props.token);
  roles.value = data.roles || [];
}

async function loadUsers(nextPage = pagination.page) {
  pagination.page = nextPage;
  error.value = '';

  try {
    const data = await apiGet(`/api/users?${toQuery()}`, props.token);
    users.value = data.rows || [];
    pagination.page = data.pagination?.page || pagination.page;
    pagination.totalPages = data.pagination?.totalPages || 1;
  } catch (err) {
    error.value = err.message || 'Failed to load users';
  }
}

function closeModals() {
  modals.add = false;
  modals.edit = false;
  modals.reset = false;
  modalError.value = '';
}

function openAddModal() {
  closeModals();
  modals.add = true;
}

async function openEditModal(user) {
  error.value = '';
  try {
    const data = await apiGet(`/api/users/${user.id}`, props.token);
    const current = data.user;
    editForm.id = current.id;
    editForm.username = current.username;
    editForm.role_name = current.role;
    editForm.location_code = current.location_code;
    editForm.department_code = current.department_code;
    editForm.status = current.status;
    closeModals();
    modals.edit = true;
  } catch (err) {
    error.value = err.message || 'Failed to load user details';
  }
}

function openResetModal(user) {
  closeModals();
  resetForm.id = user.id;
  resetForm.username = user.username;
  resetForm.password = '';
  modals.reset = true;
}

async function submitAddUser() {
  modalError.value = '';

  if (!passwordComplexEnough(addForm.password)) {
    modalError.value = 'Password does not meet complexity policy.';
    return;
  }

  try {
    await apiPost('/api/auth/register', props.token, {
      username: addForm.username,
      full_name: addForm.full_name,
      email: addForm.email || null,
      password: addForm.password,
      role_name: addForm.role_name,
      location_code: addForm.location_code,
      department_code: addForm.department_code
    });

    closeModals();
    notice.value = `User ${addForm.username} created.`;
    await loadUsers(1);
  } catch (err) {
    modalError.value = err.message || 'Failed to create user';
  }
}

async function submitEditUser() {
  modalError.value = '';

  try {
    await apiPut(`/api/users/${editForm.id}`, props.token, {
      role_name: editForm.role_name,
      location_code: editForm.location_code,
      department_code: editForm.department_code,
      status: editForm.status
    });

    closeModals();
    notice.value = `User ${editForm.username} updated.`;
    await loadUsers(pagination.page);
  } catch (err) {
    modalError.value = err.message || 'Failed to update user';
  }
}

async function submitResetPassword() {
  modalError.value = '';

  if (!confirm('Are you sure?')) return;

  if (!passwordComplexEnough(resetForm.password)) {
    modalError.value = 'Password does not meet complexity policy.';
    return;
  }

  try {
    await apiPost(`/api/users/${resetForm.id}/reset-password`, props.token, {
      password: resetForm.password
    });

    closeModals();
    notice.value = `Password reset for ${resetForm.username}.`;
  } catch (err) {
    modalError.value = err.message || 'Failed to reset password';
  }
}

async function toggleActive(user) {
  if (!confirm('Are you sure?')) return;

  error.value = '';

  try {
    await apiPut(`/api/users/${user.id}`, props.token, {
      status: user.is_active ? 'Inactive' : 'Active'
    });

    notice.value = `${user.username} is now ${user.is_active ? 'Inactive' : 'Active'}.`;
    await loadUsers(pagination.page);
  } catch (err) {
    error.value = err.message || 'Failed to update user status';
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadRoles(), loadUsers(1)]);
  } catch (err) {
    error.value = err.message || 'Failed to load user management view';
  }
});
</script>
