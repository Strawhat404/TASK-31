import Router from 'koa-router';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { logAuditEvent } from '../utils/audit.js';
import { detectPrivilegeEscalation } from '../services/securityMonitorService.js';
import { hashPassword, validatePasswordComplexity } from '../utils/crypto.js';

const router = new Router({ prefix: '/api/users' });

function parsePage(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function normalizeShortText(value, maxLength = 64) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function parseUserStatus({ status, isActive }) {
  let normalizedFromStatus = null;
  if (status !== undefined) {
    if (typeof status !== 'string') {
      return { error: 'status must be "Active" or "Inactive"' };
    }

    const lower = status.trim().toLowerCase();
    if (lower === 'active') normalizedFromStatus = 1;
    else if (lower === 'inactive') normalizedFromStatus = 0;
    else return { error: 'status must be "Active" or "Inactive"' };
  }

  let normalizedFromIsActive = null;
  if (isActive !== undefined) {
    if ([true, 1, '1', 'true'].includes(isActive)) normalizedFromIsActive = 1;
    else if ([false, 0, '0', 'false'].includes(isActive)) normalizedFromIsActive = 0;
    else return { error: 'is_active must be a boolean-like value' };
  }

  if (
    normalizedFromStatus !== null &&
    normalizedFromIsActive !== null &&
    normalizedFromStatus !== normalizedFromIsActive
  ) {
    return { error: 'status and is_active conflict' };
  }

  if (normalizedFromStatus !== null) return { value: normalizedFromStatus };
  if (normalizedFromIsActive !== null) return { value: normalizedFromIsActive };
  return { value: null };
}

function buildUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    location_code: row.location_code,
    department_code: row.department_code,
    is_active: Number(row.is_active || 0) === 1,
    status: Number(row.is_active || 0) === 1 ? 'Active' : 'Inactive',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get('/', authRequired, requireRoles('Administrator'), async (ctx) => {
  const page = parsePage(ctx.query.page, 1);
  const pageSize = Math.min(parsePage(ctx.query.pageSize, 25), 100);
  const offset = (page - 1) * pageSize;

  const q = normalizeShortText(ctx.query.q, 100);
  const role = normalizeShortText(ctx.query.role, 64);
  const location = normalizeShortText(ctx.query.location, 32);
  const department = normalizeShortText(ctx.query.department, 32);

  let statusFilter = null;
  if (ctx.query.status !== undefined) {
    const status = String(ctx.query.status).trim().toLowerCase();
    if (status === 'active') statusFilter = 1;
    else if (status === 'inactive') statusFilter = 0;
    else {
      ctx.status = 400;
      ctx.body = { error: 'status filter must be Active or Inactive' };
      return;
    }
  }

  let where = ' WHERE 1 = 1 ';
  const params = [];

  if (q) {
    where += ' AND (u.username LIKE ? OR u.full_name LIKE ? OR COALESCE(u.email, \'\') LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  if (role) {
    where += ' AND r.name = ?';
    params.push(role);
  }

  if (location) {
    where += ' AND u.location_code = ?';
    params.push(location);
  }

  if (department) {
    where += ' AND u.department_code = ?';
    params.push(department);
  }

  if (statusFilter !== null) {
    where += ' AND u.is_active = ?';
    params.push(statusFilter);
  }

  const countRows = await query(
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ${where}`,
    [...params]
  );

  const rows = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.location_code, u.department_code,
            u.is_active, u.created_at, u.updated_at, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ${where}
     ORDER BY u.updated_at DESC, u.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const total = Number(countRows[0]?.total || 0);
  ctx.body = {
    rows: rows.map(buildUserRow),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
});

router.get('/:id', authRequired, requireRoles('Administrator'), async (ctx) => {
  const userId = Number.parseInt(String(ctx.params.id || ''), 10);
  if (!Number.isFinite(userId) || userId < 1) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid user id' };
    return;
  }

  const rows = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.location_code, u.department_code,
            u.is_active, u.created_at, u.updated_at, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [userId]
  );

  if (!rows.length) {
    ctx.status = 404;
    ctx.body = { error: 'User not found' };
    return;
  }

  ctx.body = { user: buildUserRow(rows[0]) };
});

router.put('/:id', authRequired, requireRoles('Administrator'), async (ctx) => {
  const userId = Number.parseInt(String(ctx.params.id || ''), 10);
  if (!Number.isFinite(userId) || userId < 1) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid user id' };
    return;
  }

  const body = ctx.request.body || {};

  const currentRows = await query(
    `SELECT u.id, u.username, u.role_id, u.location_code, u.department_code, u.is_active, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [userId]
  );

  if (!currentRows.length) {
    ctx.status = 404;
    ctx.body = { error: 'User not found' };
    return;
  }

  const current = currentRows[0];

  let nextRoleId = current.role_id;
  let nextRoleName = current.role;
  if (body.role_name !== undefined) {
    const roleName = normalizeShortText(body.role_name, 64);
    if (!roleName) {
      ctx.status = 400;
      ctx.body = { error: 'role_name cannot be empty' };
      return;
    }

    const roleRows = await query('SELECT id, name FROM roles WHERE name = ?', [roleName]);
    if (!roleRows.length) {
      ctx.status = 400;
      ctx.body = { error: 'Invalid role_name' };
      return;
    }

    nextRoleId = roleRows[0].id;
    nextRoleName = roleRows[0].name;
  }

  let nextLocationCode = current.location_code;
  if (body.location_code !== undefined) {
    nextLocationCode = normalizeShortText(body.location_code, 32);
    if (!nextLocationCode) {
      ctx.status = 400;
      ctx.body = { error: 'location_code cannot be empty' };
      return;
    }
  }

  let nextDepartmentCode = current.department_code;
  if (body.department_code !== undefined) {
    nextDepartmentCode = normalizeShortText(body.department_code, 32);
    if (!nextDepartmentCode) {
      ctx.status = 400;
      ctx.body = { error: 'department_code cannot be empty' };
      return;
    }
  }

  const parsedStatus = parseUserStatus({ status: body.status, isActive: body.is_active });
  if (parsedStatus.error) {
    ctx.status = 400;
    ctx.body = { error: parsedStatus.error };
    return;
  }

  const nextIsActive = parsedStatus.value === null ? Number(current.is_active || 0) : parsedStatus.value;

  if (ctx.state.user.id === userId && nextIsActive === 0) {
    ctx.status = 400;
    ctx.body = { error: 'Administrators cannot deactivate their own account' };
    return;
  }

  const changedFields = {};
  if (current.role !== nextRoleName) {
    changedFields.role_name = { from: current.role, to: nextRoleName };
  }
  if (current.location_code !== nextLocationCode) {
    changedFields.location_code = { from: current.location_code, to: nextLocationCode };
  }
  if (current.department_code !== nextDepartmentCode) {
    changedFields.department_code = { from: current.department_code, to: nextDepartmentCode };
  }
  if (Number(current.is_active || 0) !== nextIsActive) {
    changedFields.status = {
      from: Number(current.is_active || 0) === 1 ? 'Active' : 'Inactive',
      to: nextIsActive === 1 ? 'Active' : 'Inactive'
    };
  }

  if (!Object.keys(changedFields).length) {
    const unchangedRows = await query(
      `SELECT u.id, u.username, u.email, u.full_name, u.location_code, u.department_code,
              u.is_active, u.created_at, u.updated_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [userId]
    );
    ctx.body = { success: true, updated: false, user: buildUserRow(unchangedRows[0]) };
    return;
  }

  await query(
    `UPDATE users
     SET role_id = ?, location_code = ?, department_code = ?, is_active = ?
     WHERE id = ?`,
    [nextRoleId, nextLocationCode, nextDepartmentCode, nextIsActive, userId]
  );

  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'iam.user.update',
    targetTable: 'users',
    targetRecordId: userId,
    locationCode: nextLocationCode,
    departmentCode: nextDepartmentCode,
    details: {
      actorUsername: ctx.state.user.username,
      targetUsername: current.username,
      changedFields
    }
  });

  if (current.role !== nextRoleName) {
    await detectPrivilegeEscalation({
      actorUserId: ctx.state.user.id,
      actorRole: ctx.state.user.role,
      action: 'iam.user.role_update',
      targetUserId: userId,
      assignedRole: nextRoleName
    });
  }

  const updatedRows = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.location_code, u.department_code,
            u.is_active, u.created_at, u.updated_at, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [userId]
  );

  ctx.body = { success: true, updated: true, user: buildUserRow(updatedRows[0]) };
});

router.post('/:id/reset-password', authRequired, requireRoles('Administrator'), async (ctx) => {
  const userId = Number.parseInt(String(ctx.params.id || ''), 10);
  if (!Number.isFinite(userId) || userId < 1) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid user id' };
    return;
  }

  const password = typeof ctx.request.body?.password === 'string' ? ctx.request.body.password : '';
  if (!validatePasswordComplexity(password)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Password must be at least 12 chars and include uppercase, lowercase, number, special char'
    };
    return;
  }

  const targetRows = await query(
    `SELECT id, username, location_code, department_code
     FROM users
     WHERE id = ?`,
    [userId]
  );

  if (!targetRows.length) {
    ctx.status = 404;
    ctx.body = { error: 'User not found' };
    return;
  }

  const target = targetRows[0];
  const { salt, hash } = hashPassword(password);

  await query('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', [hash, salt, userId]);

  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'iam.user.password_reset',
    targetTable: 'users',
    targetRecordId: userId,
    locationCode: target.location_code,
    departmentCode: target.department_code,
    details: {
      actorUsername: ctx.state.user.username,
      targetUsername: target.username,
      changedFields: {
        password: { from: '[redacted]', to: '[reset]' }
      }
    }
  });

  ctx.body = { success: true };
});

export default router;
