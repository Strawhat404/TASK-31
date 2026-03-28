import Router from 'koa-router';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { enforceScope, requireRoles } from '../middleware/rbac.js';
import { logAuditEvent } from '../utils/audit.js';

const router = new Router({ prefix: '/api/inspections' });

router.get('/queue', authRequired, requireRoles('Inspector', 'Administrator'), enforceScope(), async (ctx) => {
  const inspectorId = ctx.state.user.role === 'Administrator'
    ? Number(ctx.query.inspector_id || 0) || null
    : ctx.state.user.id;

  const rows = await query(
    `SELECT a.id, a.customer_id, a.scheduled_at, a.status, a.notes, a.location_code, a.department_code,
            vr.plate_number, vr.brand, vr.model_name, vr.model_year
     FROM appointments a
     LEFT JOIN vehicle_records vr ON vr.appointment_id = a.id
     WHERE a.status IN ('scheduled', 'checked_in')
       AND (? IS NULL OR a.inspector_id = ?)
       AND a.location_code = ?
       AND a.department_code = ?
     ORDER BY a.scheduled_at ASC
     LIMIT 200`,
    [inspectorId, inspectorId, ctx.state.user.locationCode, ctx.state.user.departmentCode]
  );

  ctx.body = { rows };
});

router.post('/results', authRequired, requireRoles('Inspector', 'Administrator'), enforceScope(), async (ctx) => {
  const body = ctx.request.body || {};
  const appointmentId = Number(body.appointment_id || 0);
  if (!appointmentId) {
    ctx.status = 400;
    ctx.body = { error: 'appointment_id is required' };
    return;
  }

  const appointmentRows = await query(
    `SELECT id, customer_id, inspector_id, location_code, department_code, status
     FROM appointments
     WHERE id = ?`,
    [appointmentId]
  );
  if (!appointmentRows.length) {
    ctx.status = 404;
    ctx.body = { error: 'Appointment not found' };
    return;
  }

  const appointment = appointmentRows[0];
  if (ctx.state.user.role !== 'Administrator' && Number(appointment.inspector_id) !== Number(ctx.state.user.id)) {
    ctx.status = 403;
    ctx.body = { error: 'Appointment not assigned to this inspector' };
    return;
  }

  if (
    appointment.location_code !== ctx.state.user.locationCode ||
    appointment.department_code !== ctx.state.user.departmentCode
  ) {
    ctx.status = 403;
    ctx.body = { error: 'Scope violation for inspection result publication' };
    return;
  }

  const existing = await query('SELECT id FROM inspection_results WHERE appointment_id = ?', [appointmentId]);
  if (existing.length) {
    ctx.status = 409;
    ctx.body = { error: 'Inspection result already published for this appointment' };
    return;
  }

  const outcome = String(body.outcome || '').toLowerCase();
  if (!['pass', 'fail', 'recheck_required'].includes(outcome)) {
    ctx.status = 400;
    ctx.body = { error: 'outcome must be pass, fail, or recheck_required' };
    return;
  }

  const score = body.score === null || body.score === undefined ? null : Number(body.score);
  const findings = body.findings && typeof body.findings === 'object' ? body.findings : {};
  const inspectorId = ctx.state.user.role === 'Administrator'
    ? Number(body.inspector_id || appointment.inspector_id || 0)
    : ctx.state.user.id;

  await query(
    `INSERT INTO inspection_results
      (appointment_id, inspector_id, location_code, department_code, outcome, score, findings)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      appointmentId,
      inspectorId,
      appointment.location_code,
      appointment.department_code,
      outcome,
      score,
      JSON.stringify(findings)
    ]
  );

  await query(
    `UPDATE appointments
     SET status = 'completed', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [appointmentId]
  );

  const idRows = await query('SELECT LAST_INSERT_ID() AS id');
  const resultId = idRows[0].id;

  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'inspection.result.publish',
    targetTable: 'inspection_results',
    targetRecordId: resultId,
    locationCode: appointment.location_code,
    departmentCode: appointment.department_code,
    details: { appointmentId, outcome }
  });

  ctx.status = 201;
  ctx.body = { resultId, appointmentId, outcome };
});

router.get('/results/me', authRequired, requireRoles('Inspector', 'Administrator'), enforceScope(), async (ctx) => {
  const inspectorId = ctx.state.user.role === 'Administrator'
    ? Number(ctx.query.inspector_id || 0) || null
    : ctx.state.user.id;

  const rows = await query(
    `SELECT ir.id, ir.appointment_id, ir.outcome, ir.score, ir.findings, ir.completed_at
     FROM inspection_results ir
     WHERE (? IS NULL OR ir.inspector_id = ?)
       AND ir.location_code = ?
       AND ir.department_code = ?
     ORDER BY ir.completed_at DESC
     LIMIT 200`,
    [inspectorId, inspectorId, ctx.state.user.locationCode, ctx.state.user.departmentCode]
  );

  ctx.body = { rows };
});

router.get('/customer/reports', authRequired, requireRoles('Customer', 'Administrator'), async (ctx) => {
  const customerId = ctx.state.user.role === 'Administrator'
    ? Number(ctx.query.customer_id || 0) || null
    : ctx.state.user.id;

  if (!customerId) {
    ctx.status = 400;
    ctx.body = { error: 'customer_id is required' };
    return;
  }

  const rows = await query(
    `SELECT ir.id AS report_id, ir.appointment_id, ir.outcome, ir.score, ir.findings, ir.completed_at,
            vr.plate_number, vr.brand, vr.model_name, vr.model_year
     FROM inspection_results ir
     JOIN appointments a ON a.id = ir.appointment_id
     LEFT JOIN vehicle_records vr ON vr.appointment_id = a.id
     WHERE a.customer_id = ?
     ORDER BY ir.completed_at DESC
     LIMIT 200`,
    [customerId]
  );

  ctx.body = { rows };
});

export default router;
