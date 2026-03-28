import Router from 'koa-router';
import { authRequired } from '../middleware/auth.js';
import { enforceScope, requireRoles } from '../middleware/rbac.js';
import { validateAndIngestFile } from '../services/fileGovernanceService.js';
import { logAuditEvent } from '../utils/audit.js';

const router = new Router({ prefix: '/api/files' });

router.post(
  '/ingest',
  authRequired,
  requireRoles('Coordinator', 'Inspector', 'Data Engineer', 'Administrator'),
  enforceScope(),
  async (ctx) => {
    const body = ctx.request.body || {};
    const locationCode = ctx.state.user.locationCode;
    const departmentCode = ctx.state.user.departmentCode;
    const result = await validateAndIngestFile({
      uploaderId: ctx.state.user.id,
      locationCode,
      departmentCode,
      sourcePath: body.source_path,
      mimeType: body.mime_type,
      linkedTable: body.linked_table,
      linkedRecordId: body.linked_record_id
    });

    await logAuditEvent({
      actorUserId: ctx.state.user.id,
      actorRole: ctx.state.user.role,
      action: result.quarantined ? 'file.quarantined' : 'file.ingested',
      targetTable: 'files',
      targetRecordId: result.fileId,
      locationCode,
      departmentCode,
      details: { checksum: result.checksum, sensitivePattern: result.sensitivePattern }
    });

    ctx.status = 201;
    ctx.body = result;
  }
);

export default router;
