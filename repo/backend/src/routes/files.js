import Router from 'koa-router';
import fs from 'fs';
import { authRequired } from '../middleware/auth.js';
import { enforceScope, requireRoles } from '../middleware/rbac.js';
import { findAuthorizedFileDownload, validateAndIngestFile } from '../services/fileGovernanceService.js';
import { config } from '../config.js';
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

router.get('/download/:id', authRequired, async (ctx) => {
  const fileId = Number.parseInt(String(ctx.params.id || ''), 10);
  if (!Number.isFinite(fileId) || fileId < 1) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid file id' };
    return;
  }

  const referer = String(ctx.get('Referer') || '');
  if (!referer || !referer.startsWith(config.frontend.origin)) {
    ctx.status = 403;
    ctx.body = { error: 'Hotlink protection blocked this download request' };
    return;
  }

  const file = await findAuthorizedFileDownload({
    fileId,
    actor: ctx.state.user
  });
  if (!file) {
    ctx.status = 404;
    ctx.body = { error: 'File not found' };
    return;
  }

  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'file.download',
    targetTable: 'files',
    targetRecordId: file.id,
    locationCode: file.location_code,
    departmentCode: file.department_code
  });

  ctx.set('Content-Type', file.mime_type || 'application/octet-stream');
  ctx.set('Content-Disposition', `attachment; filename="${file.file_name}"`);
  ctx.body = fs.createReadStream(file.storage_path);
});

export default router;
