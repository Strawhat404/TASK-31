import { query } from '../db.js';
import { enqueueIngestionJob, runIngestionQueueOnce } from './ingestionService.js';
import { safeLog } from '../utils/redaction.js';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
let fallbackTimer = null;
let cronTask = null;

async function resolveSystemSubmitterId() {
  const rows = await query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = 1
     ORDER BY (r.name = 'Administrator') DESC, u.id ASC
     LIMIT 1`
  );
  return Number(rows[0]?.id || 0);
}

async function runScheduledIngestionTick() {
  const submittedBy = await resolveSystemSubmitterId();
  if (!submittedBy) {
    safeLog('ingestion_scheduler.no_submitter');
    return;
  }

  await enqueueIngestionJob({
    submittedBy,
    sourceSystem: 'local_network_share',
    jobType: 'network_share_import',
    priority: 100,
    payload: {
      connector: 'network_share_stub',
      sourcePath: 'local_network_share://stub',
      datasetName: 'network_share_ingest',
      incremental: true
    },
    dependencyJobIds: [],
    backfillDays: 0
  });

  const result = await runIngestionQueueOnce();
  safeLog('ingestion_scheduler.tick', { result });
}

export async function startIngestionScheduler({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (cronTask || fallbackTimer) return;

  try {
    const cron = (await import('node-cron')).default;
    cronTask = cron.schedule('0 * * * *', () => {
      runScheduledIngestionTick().catch((error) => {
        safeLog('ingestion_scheduler.tick_failed', { error: error.message });
      });
    });
    safeLog('ingestion_scheduler.started', { mode: 'node-cron', schedule: '0 * * * *' });
    return;
  } catch (_error) {
    fallbackTimer = setInterval(() => {
      runScheduledIngestionTick().catch((error) => {
        safeLog('ingestion_scheduler.tick_failed', { error: error.message });
      });
    }, intervalMs);
    safeLog('ingestion_scheduler.started', { mode: 'interval', intervalMs });
  }
}

export function stopIngestionScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
}
