import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'text/plain', 'text/csv', 'image/png', 'image/jpeg']);
const ALLOWED_EXT = new Set(['.pdf', '.txt', '.csv', '.png', '.jpg', '.jpeg']);

const SENSITIVE_PATTERNS = [
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'ssn_compact', regex: /\b\d{9}\b/g }
];

function hashContent(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function scanSensitive(buffer) {
  const text = buffer.toString('utf8');
  for (const p of SENSITIVE_PATTERNS) {
    if (p.regex.test(text)) return p.name;
  }
  return null;
}

export async function validateAndIngestFile({
  uploaderId,
  locationCode,
  departmentCode,
  sourcePath,
  mimeType,
  linkedTable,
  linkedRecordId
}) {
  const resolved = path.resolve(sourcePath);
  if (!fs.existsSync(resolved)) throw new Error('File not found');

  const stat = fs.statSync(resolved);
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error('File exceeds 50MB limit');
  }

  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error('Blocked file extension');
  }

  if (mimeType && !ALLOWED_MIME.has(mimeType)) {
    throw new Error('Blocked MIME type');
  }

  const buffer = fs.readFileSync(resolved);
  const checksum = hashContent(buffer);

  const blocked = await query('SELECT id FROM blocked_file_hashes WHERE checksum_sha256 = ?', [checksum]);
  if (blocked.length) {
    throw new Error('File hash is blocked by governance policy');
  }

  await query(
    `INSERT INTO files
      (uploaded_by, storage_path, file_name, mime_type, file_size_bytes, checksum_sha256, linked_table, linked_record_id, location_code, department_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uploaderId,
      resolved,
      path.basename(resolved),
      mimeType || null,
      stat.size,
      checksum,
      linkedTable || null,
      linkedRecordId || null,
      locationCode,
      departmentCode
    ]
  );

  const rows = await query('SELECT LAST_INSERT_ID() AS id');
  const fileId = rows[0].id;

  const sensitiveMatch = scanSensitive(buffer);
  if (sensitiveMatch) {
    await query(
      'INSERT INTO file_quarantine (file_id, reason, matched_pattern) VALUES (?, ?, ?)',
      [fileId, 'Sensitive content detected', sensitiveMatch]
    );
  }

  return {
    fileId,
    checksum,
    quarantined: Boolean(sensitiveMatch),
    sensitivePattern: sensitiveMatch
  };
}
