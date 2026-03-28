import Router from 'koa-router';
import { authRequired } from '../middleware/auth.js';
import { enforceScope, requireRoles } from '../middleware/rbac.js';
import { createMessage, exportPendingOutbox, inbox } from '../services/messagingService.js';
import { logAuditEvent } from '../utils/audit.js';
import { redactObject } from '../utils/redaction.js';

const router = new Router({ prefix: '/api/messages' });

router.post('/send', authRequired, requireRoles('Coordinator', 'Administrator', 'Inspector'), async (ctx) => {
  const body = ctx.request.body || {};
  const result = await createMessage({
    senderUserId: ctx.state.user.id,
    recipientUserId: body.recipient_user_id,
    messageType: body.message_type || 'system_notice',
    subject: body.subject || 'RoadSafe Notification',
    body: body.body || '',
    channels: Array.isArray(body.channels) ? body.channels : ['sms']
  });

  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'messaging.message_created',
    targetTable: 'messages',
    targetRecordId: result.messageId,
    locationCode: ctx.state.user.locationCode,
    departmentCode: ctx.state.user.departmentCode
  });

  ctx.status = 201;
  ctx.body = result;
});

router.get('/inbox', authRequired, async (ctx) => {
  const rows = await inbox(ctx.state.user.id);
  ctx.body = {
    messages: ctx.state.user.role === 'Administrator' ? rows : redactObject(rows)
  };
});

router.post(
  '/outbox/export',
  authRequired,
  requireRoles('Coordinator', 'Administrator', 'Data Engineer'),
  enforceScope(),
  async (ctx) => {
  const rows = await exportPendingOutbox({
    markExported: true,
    locationCode: ctx.state.user.locationCode,
    departmentCode: ctx.state.user.departmentCode
  });
  ctx.body = {
    exported: rows.length,
    rows: ctx.state.user.role === 'Administrator' ? rows : redactObject(rows)
  };
  }
);

router.get(
  '/outbox',
  authRequired,
  requireRoles('Coordinator', 'Administrator', 'Data Engineer'),
  enforceScope(),
  async (ctx) => {
  const rows = await exportPendingOutbox({
    markExported: false,
    locationCode: ctx.state.user.locationCode,
    departmentCode: ctx.state.user.departmentCode
  });
  ctx.body = {
    rows: ctx.state.user.role === 'Administrator' ? rows : redactObject(rows)
  };
  }
);

export default router;
