import Router from 'koa-router';
import fs from 'fs';
import path from 'path';
import { authRequired } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { logAuditEvent } from '../utils/audit.js';
import { enqueueIngestionJob, runIngestionQueueOnce } from '../services/ingestionService.js';
import { config } from '../config.js';
import { query } from '../db.js';

const router = new Router({ prefix: '/api/ingestion' });

router.post('/jobs', authRequired, requireRoles('Data Engineer', 'Administrator'), async (ctx) => {
  const body = ctx.request.body || {};
  const payload = {
    csvPath: body.csv_path,
    deviceExportPath: body.device_export_path,
    sourcePath: body.source_path,
    datasetName: body.dataset_name,
    sourceSystem: body.source_system || 'csv_drop'
  };

  const result = await enqueueIngestionJob({
    submittedBy: ctx.state.user.id,
    sourceSystem: body.source_system || 'csv_drop',
    jobType: body.job_type || 'csv_import',
    priority: Number(body.priority || 100),
    payload,
    dependencyJobIds: body.dependencies || [],
    backfillDays: Number(body.backfill_days || 0)
  });

  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'ingestion.job.enqueued',
    targetTable: 'ingestion_jobs',
    targetRecordId: result.jobId,
    locationCode: ctx.state.user.locationCode,
    departmentCode: ctx.state.user.departmentCode,
    details: payload
  });

  ctx.status = 201;
  ctx.body = result;
});

router.post('/run-once', authRequired, requireRoles('Data Engineer', 'Administrator'), async (ctx) => {
  const result = await runIngestionQueueOnce();
  ctx.body = result;
});

router.get('/jobs/:id', authRequired, requireRoles('Data Engineer', 'Administrator'), async (ctx) => {
  const rows = await query('SELECT * FROM ingestion_jobs WHERE id = ?', [ctx.params.id]);
  if (!rows.length) {
    ctx.status = 404;
    ctx.body = { error: 'Job not found' };
    return;
  }

  const checkpoints = await query(
    'SELECT checkpoint_key, checkpoint_value, created_at FROM ingestion_checkpoints WHERE ingestion_job_id = ? ORDER BY id',
    [ctx.params.id]
  );

  ctx.body = {
    job: rows[0],
    checkpoints
  };
});

router.post('/drop-scan', authRequired, requireRoles('Data Engineer', 'Administrator'), async (ctx) => {
  const body = ctx.request.body || {};
  const dropPath = body.drop_path || config.ingestion.dropRoot;
  if (!dropPath) {
    ctx.status = 400;
    ctx.body = { error: 'drop_path is required' };
    return;
  }

  const entries = fs.readdirSync(path.resolve(dropPath), { withFileTypes: true });
  const csvFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.csv'))
    .map((e) => path.resolve(dropPath, e.name));

  const jobIds = [];
  for (const filePath of csvFiles) {
    const queued = await enqueueIngestionJob({
      submittedBy: ctx.state.user.id,
      sourceSystem: 'csv_drop',
      jobType: 'csv_import',
      priority: 100,
      payload: {
        csvPath: filePath,
        datasetName: body.dataset_name || 'inspection_ingest',
        sourceSystem: 'csv_drop'
      },
      dependencyJobIds: [],
      backfillDays: Number(body.backfill_days || 0)
    });
    jobIds.push(queued.jobId);
  }

  ctx.body = { queued: jobIds.length, jobIds };
});

export default router;
