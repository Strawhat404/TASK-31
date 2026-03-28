import { execute, query } from '../db.js';
import { decryptText, encryptText } from '../utils/encryption.js';

export async function createMessage({ senderUserId, recipientUserId, messageType, subject, body, channels }) {
  const bodyEncrypted = encryptText(body);
  await query(
    `INSERT INTO messages (sender_user_id, recipient_user_id, message_type, subject, body_encrypted, status)
     VALUES (?, ?, ?, ?, ?, 'queued')`,
    [senderUserId, recipientUserId, messageType, subject, bodyEncrypted]
  );

  const rows = await query('SELECT LAST_INSERT_ID() AS id');
  const messageId = rows[0].id;

  const recipientRows = await query('SELECT email, username FROM users WHERE id = ?', [recipientUserId]);
  const recipient = recipientRows[0] || {};

  for (const channel of channels || []) {
    const payload = JSON.stringify({ subject, body, channel });
    await query(
      `INSERT INTO manual_delivery_outbox (message_id, channel, recipient_encrypted, payload_encrypted)
       VALUES (?, ?, ?, ?)`,
      [
        messageId,
        channel,
        encryptText(recipient.email || recipient.username || `user:${recipientUserId}`),
        encryptText(payload)
      ]
    );
  }

  return { messageId };
}

export async function inbox(userId) {
  const rows = await query(
    `SELECT id, sender_user_id, recipient_user_id, message_type, subject, body_encrypted, status, created_at, read_at
     FROM messages
     WHERE recipient_user_id = ?
     ORDER BY created_at DESC
     LIMIT 200`,
    [userId]
  );

  return rows.map((r) => ({
    ...r,
    body: decryptText(r.body_encrypted)
  }));
}

export async function exportPendingOutbox({
  markExported = true,
  locationCode,
  departmentCode
} = {}) {
  if (!locationCode || !departmentCode) {
    throw new Error('locationCode and departmentCode are required for outbox export');
  }

  const rows = await query(
    `SELECT o.id, o.message_id, o.channel, o.recipient_encrypted, o.payload_encrypted, o.created_at
     FROM manual_delivery_outbox o
     JOIN messages m ON m.id = o.message_id
     JOIN users s ON s.id = m.sender_user_id
     WHERE o.export_status = 'pending'
       AND s.location_code = ?
       AND s.department_code = ?
     ORDER BY o.created_at ASC`,
    [locationCode, departmentCode]
  );

  const decoded = rows.map((r) => ({
    id: r.id,
    message_id: r.message_id,
    channel: r.channel,
    recipient: decryptText(r.recipient_encrypted),
    payload: JSON.parse(decryptText(r.payload_encrypted)),
    created_at: r.created_at
  }));

  if (markExported && rows.length) {
    await execute(
      `UPDATE manual_delivery_outbox
       SET export_status = 'exported', exported_at = UTC_TIMESTAMP()
       WHERE id IN (${rows.map(() => '?').join(',')})`,
      rows.map((r) => r.id)
    );
  }

  return decoded;
}
