import fs from 'fs';
import path from 'path';
import { query } from '../db.js';

const RETENTION_YEARS = 2;

export async function purgeExpiredAuditEvents() {
  const result = await query(
    `DELETE FROM audit_events
     WHERE event_time < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? YEAR)`,
    [RETENTION_YEARS]
  );

  return {
    purged: Number(result.affectedRows || 0),
    retentionYears: RETENTION_YEARS
  };
}

export async function exportAuditLedger({ outputDir = '/tmp' } = {}) {
  const rows = await query(
    `SELECT id, event_time, actor_user_id, actor_role, action, target_table, target_record_id,
            location_code, department_code, event_hash, details
     FROM audit_events
     ORDER BY id ASC`
  );

  const safeDir = path.resolve(outputDir);
  fs.mkdirSync(safeDir, { recursive: true });

  const filePath = path.join(safeDir, `audit-ledger-${Date.now()}.jsonl`);
  const jsonl = rows.map((row) => JSON.stringify(row)).join('\n');
  fs.writeFileSync(filePath, jsonl ? `${jsonl}\n` : '', 'utf8');

  return {
    exported: rows.length,
    filePath
  };
}
