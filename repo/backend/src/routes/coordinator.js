import Router from 'koa-router';
import { authRequired } from '../middleware/auth.js';
import { enforceScope, requireRoles } from '../middleware/rbac.js';
import { logAuditEvent } from '../utils/audit.js';
import { query } from '../db.js';
import {
  assignSeatToAppointment,
  listMaintenanceWindows,
  listOpenAppointments,
  listBayUtilization,
  listSeats,
  scheduleAppointment,
  upsertSeats
} from '../services/schedulingService.js';

const router = new Router({ prefix: '/api/coordinator' });

router.post(
  '/appointments/schedule',
  authRequired,
  requireRoles('Coordinator', 'Administrator'),
  enforceScope(),
  async (ctx) => {
    const body = ctx.request.body || {};
    const locationCode = body.location_code || ctx.state.user.locationCode;
    const departmentCode = body.department_code || ctx.state.user.departmentCode;
    const customerId = Number(body.customer_id || 0);

    if (!customerId) {
      ctx.status = 400;
      ctx.body = { error: 'customer_id is required' };
      return;
    }

    const lockRows = await query(
      `SELECT id
       FROM appointments
       WHERE coordinator_id = ?
         AND customer_id = ?
         AND location_code = ?
         AND department_code = ?
         AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
       ORDER BY created_at DESC
       LIMIT 1`,
      [ctx.state.user.id, customerId, locationCode, departmentCode]
    );
    if (lockRows.length) {
      ctx.status = 409;
      ctx.body = { error: 'Submission lock active for 5 minutes. Retry later.' };
      return;
    }

    let result;
    try {
      result = await scheduleAppointment({
        customerId,
        coordinatorId: ctx.state.user.id,
        locationCode,
        departmentCode,
        scheduledAt: body.scheduled_at,
        notes: body.notes,
        vehicleType: body.vehicle_type
      });
    } catch (error) {
      if (error.code === 'DUPLICATE_APPOINTMENT') {
        ctx.status = 409;
        ctx.body = { error: error.message };
        return;
      }
      throw error;
    }

    await logAuditEvent({
      actorUserId: ctx.state.user.id,
      actorRole: ctx.state.user.role,
      action: 'coordinator.schedule_appointment',
      targetTable: 'appointments',
      targetRecordId: result.appointmentId,
      locationCode,
      departmentCode,
      details: {
        inspectorId: result.inspectorId,
        bayResourceId: result.bayResourceId,
        equipmentResourceId: result.equipmentResourceId
      }
    });

    ctx.status = 201;
    ctx.body = result;
  }
);

router.get('/bay-utilization', authRequired, enforceScope(), async (ctx) => {
  const locationCode = ctx.query.location || ctx.state.user.locationCode;
  const departmentCode = ctx.query.department || ctx.state.user.departmentCode;
  const from = ctx.query.from || new Date().toISOString();
  const to =
    ctx.query.to ||
    new Date(new Date(from).getTime() + 8 * 60 * 60 * 1000).toISOString();

  const rows = await listBayUtilization({ locationCode, departmentCode, from, to });
  ctx.body = { rows };
});

router.get('/waiting-room/seats', authRequired, enforceScope(), async (ctx) => {
  const locationCode = ctx.query.location || ctx.state.user.locationCode;
  const departmentCode = ctx.query.department || ctx.state.user.departmentCode;
  const rows = await listSeats({ locationCode, departmentCode });
  ctx.body = { seats: rows };
});

router.put(
  '/waiting-room/seats',
  authRequired,
  requireRoles('Coordinator', 'Administrator'),
  enforceScope(),
  async (ctx) => {
    const body = ctx.request.body || {};
    const locationCode = body.location_code || ctx.state.user.locationCode;
    const departmentCode = body.department_code || ctx.state.user.departmentCode;
    const seats = Array.isArray(body.seats) ? body.seats : [];

    await upsertSeats({ locationCode, departmentCode, seats });

    await logAuditEvent({
      actorUserId: ctx.state.user.id,
      actorRole: ctx.state.user.role,
      action: 'coordinator.update_waiting_room_seats',
      targetTable: 'waiting_room_seats',
      targetRecordId: `${locationCode}:${departmentCode}`,
      locationCode,
      departmentCode,
      details: { seatCount: seats.length }
    });

    ctx.body = { success: true };
  }
);

router.post(
  '/waiting-room/assign-seat',
  authRequired,
  requireRoles('Coordinator', 'Administrator'),
  enforceScope(),
  async (ctx) => {
    const body = ctx.request.body || {};
    const locationCode = body.location_code || ctx.state.user.locationCode;
    const departmentCode = body.department_code || ctx.state.user.departmentCode;

    if (!body.seat_id) {
      ctx.status = 400;
      ctx.body = { error: 'seat_id is required' };
      return;
    }

    try {
      await assignSeatToAppointment({
        seatId: Number(body.seat_id),
        appointmentId: Number(body.appointment_id || 0),
        locationCode,
        departmentCode
      });
    } catch (error) {
      if (error.code === 'APPOINTMENT_SCOPE_VIOLATION') {
        ctx.status = 403;
        ctx.body = { error: error.message };
        return;
      }
      throw error;
    }

    ctx.body = { success: true };
  }
);

router.get('/open-appointments', authRequired, enforceScope(), async (ctx) => {
  const locationCode = ctx.query.location || ctx.state.user.locationCode;
  const departmentCode = ctx.query.department || ctx.state.user.departmentCode;
  const rows = await listOpenAppointments({ locationCode, departmentCode });
  ctx.body = { appointments: rows };
});

router.get('/maintenance-windows', authRequired, enforceScope(), async (ctx) => {
  const locationCode = ctx.query.location || ctx.state.user.locationCode;
  const departmentCode = ctx.query.department || ctx.state.user.departmentCode;
  const rows = await listMaintenanceWindows({ locationCode, departmentCode });
  ctx.body = { windows: rows };
});

export default router;
