import { query } from '../db.js';

export async function logAuditEvent({
  actorUserId = null,
  actorRole = null,
  action,
  targetTable,
  targetRecordId = null,
  locationCode = null,
  departmentCode = null,
  details = null
}) {
  await query(
    `INSERT INTO audit_events
      (actor_user_id, actor_role, action, target_table, target_record_id, location_code, department_code, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actorUserId,
      actorRole,
      action,
      targetTable,
      targetRecordId ? String(targetRecordId) : null,
      locationCode,
      departmentCode,
      details ? JSON.stringify(details) : null
    ]
  );
}
