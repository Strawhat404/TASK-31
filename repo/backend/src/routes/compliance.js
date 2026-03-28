import Router from 'koa-router';
import { authRequired } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { createAccountClosureRequest, runRetentionSweep } from '../services/retentionService.js';
import { logAuditEvent } from '../utils/audit.js';

const router = new Router({ prefix: '/api/compliance' });

router.post('/account-closure', authRequired, async (ctx) => {
  const requestId = await createAccountClosureRequest(ctx.state.user.id);
  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'compliance.account_closure_requested',
    targetTable: 'account_closure_requests',
    targetRecordId: requestId,
    locationCode: ctx.state.user.locationCode,
    departmentCode: ctx.state.user.departmentCode
  });
  ctx.status = 201;
  ctx.body = { requestId };
});

router.post('/retention/run', authRequired, requireRoles('Administrator', 'Data Engineer'), async (ctx) => {
  const result = await runRetentionSweep();
  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'compliance.retention_sweep',
    targetTable: 'report_tombstones',
    targetRecordId: null,
    details: result
  });
  ctx.body = result;
});

export default router;
