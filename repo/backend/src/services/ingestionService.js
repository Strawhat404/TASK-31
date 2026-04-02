import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';

const MAX_BACKFILL_DAYS = 30;
const MAX_RETRIES = 5;
const CONNECTOR_CSV = 'csv';
const CONNECTOR_DEVICE_EXPORT = 'device_export';
const CONNECTOR_NETWORK_SHARE_STUB = 'network_share_stub';

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] || '').trim();
    });
    return row;
  });
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function milesToKilometers(miles) {
  return Number((toNumber(miles) * 1.60934).toFixed(4));
}

function convertToUsd(amount, currency) {
  const fx = {
    USD: 1,
    EUR: 1.08,
    KES: 0.0078,
    GBP: 1.27,
    JPY: 0.0068
  };
  const rate = fx[String(currency || 'USD').toUpperCase()] || 1;
  return Number((toNumber(amount) * rate).toFixed(2));
}

function deterministicKey(row) {
  const source = [
    row.vehicle_plate || '',
    row.customer_id || '',
    row.appointment_ts || '',
    row.location_code || '',
    row.department_code || ''
  ].join('|');
  return crypto.createHash('sha256').update(source).digest('hex');
}

function similarity(a, b) {
  const s1 = String(a || '').toLowerCase();
  const s2 = String(b || '').toLowerCase();
  if (!s1 && !s2) return 1;
  const common = [...new Set(s1.split(''))].filter((c) => s2.includes(c)).length;
  return common / Math.max(new Set(s1).size || 1, new Set(s2).size || 1);
}

function dedupeRows(rows) {
  const byKey = new Map();
  const kept = [];
  let duplicates = 0;

  for (const row of rows) {
    const key = deterministicKey(row);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      kept.push(row);
      continue;
    }

    const sim = similarity(existing.vehicle_plate, row.vehicle_plate);
    if (sim >= 0.85) {
      duplicates += 1;
      continue;
    }

    kept.push(row);
  }

  return { rows: kept, duplicateCount: duplicates };
}

function normalizedRow(raw) {
  return {
    ...raw,
    distance_km: milesToKilometers(raw.distance_miles),
    price_usd: convertToUsd(raw.price_amount, raw.price_currency)
  };
}

function parseJsonRows(content) {
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.records)) return parsed.records;
  if (parsed && typeof parsed === 'object') return [parsed];
  return [];
}

function normalizeDeviceExportRow(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    vehicle_plate: safe.vehicle_plate || safe.plate || safe.plate_number || '',
    customer_id: String(safe.customer_id || safe.customerId || safe.owner_id || ''),
    appointment_ts: safe.appointment_ts || safe.appointment_time || safe.test_time || '',
    location_code: safe.location_code || safe.location || 'HQ',
    department_code: safe.department_code || safe.department || 'OPS',
    distance_miles: safe.distance_miles || safe.odometer_miles || 0,
    price_amount: safe.price_amount || safe.fee_amount || 0,
    price_currency: safe.price_currency || safe.currency || 'USD',
    source_device_id: safe.source_device_id || safe.device_id || '',
    export_batch_id: safe.export_batch_id || safe.batch_id || ''
  };
}

function getMissingFieldsRate(rows) {
  if (!rows.length) return 0;
  const required = ['vehicle_plate', 'customer_id', 'appointment_ts', 'location_code', 'department_code'];
  let missing = 0;
  for (const row of rows) {
    for (const key of required) {
      if (!row[key]) missing += 1;
    }
  }
  return Number((missing / (rows.length * required.length)).toFixed(5));
}

async function nextDatasetVersion(datasetName) {
  const rows = await query('SELECT COALESCE(MAX(version_no), 0) AS v FROM dataset_versions WHERE dataset_name = ?', [datasetName]);
  return Number(rows[0].v) + 1;
}

async function baselineMetrics(datasetName) {
  const rows = await query(
    `SELECT missing_fields_rate, duplicate_rate
     FROM dataset_versions
     WHERE dataset_name = ?
     ORDER BY created_at DESC
     LIMIT 14`,
    [datasetName]
  );

  if (!rows.length) return { missing: 0, duplicate: 0, count: 0 };
  const missing = rows.reduce((s, r) => s + Number(r.missing_fields_rate), 0) / rows.length;
  const duplicate = rows.reduce((s, r) => s + Number(r.duplicate_rate), 0) / rows.length;
  return { missing, duplicate, count: rows.length };
}

function deviationPercent(current, baseline) {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return Number((Math.abs((current - baseline) / baseline) * 100).toFixed(5));
}

function extractPriority(payload) {
  return Number(payload?.priority ?? 100);
}

function pickJobByPriority(jobs) {
  const queued = (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.status === 'queued');
  if (!queued.length) return null;

  return queued
    .slice()
    .sort((a, b) => {
      const ap = extractPriority(a.payload || {});
      const bp = extractPriority(b.payload || {});
      if (ap !== bp) return ap - bp;
      const at = new Date(a.created_at || 0).getTime();
      const bt = new Date(b.created_at || 0).getTime();
      return at - bt;
    })[0];
}

function computeRetryState(payload = {}) {
  const retries = Number(payload.retries || 0) + 1;
  if (retries > MAX_RETRIES) {
    return { retries, shouldFail: true, retryAfterMs: 0 };
  }
  return { retries, shouldFail: false, retryAfterMs: 2 ** retries * 1000 };
}

function buildCheckpointSnapshot({ parsedRows, writtenRows, versionNo }) {
  return {
    rows_parsed: Number(parsedRows || 0),
    rows_written: Number(writtenRows || 0),
    dataset_version: Number(versionNo || 0),
    last_processed_row: Number(parsedRows || 0)
  };
}

export async function enqueueIngestionJob({
  submittedBy,
  sourceSystem,
  jobType,
  priority = 100,
  payload,
  dependencyJobIds = [],
  backfillDays = 0
}) {
  if (backfillDays > MAX_BACKFILL_DAYS) {
    throw new Error('Backfill window cannot exceed 30 days');
  }

  await query(
    `INSERT INTO ingestion_jobs
      (submitted_by, source_system, job_type, status, payload)
     VALUES (?, ?, ?, 'queued', ?)`,
    [submittedBy, sourceSystem, jobType, JSON.stringify({ ...payload, priority, backfillDays, retries: 0 })]
  );

  const rows = await query('SELECT LAST_INSERT_ID() AS id');
  const jobId = rows[0].id;

  for (const depId of dependencyJobIds) {
    await query(
      'INSERT INTO ingestion_job_dependencies (job_id, depends_on_job_id) VALUES (?, ?)',
      [jobId, depId]
    );
  }

  return { jobId };
}

async function dependenciesSatisfied(jobId) {
  const rows = await query(
    `SELECT COUNT(*) AS pending
     FROM ingestion_job_dependencies d
     JOIN ingestion_jobs j ON j.id = d.depends_on_job_id
     WHERE d.job_id = ? AND j.status <> 'completed'`,
    [jobId]
  );
  return Number(rows[0].pending) === 0;
}

async function pickNextJob() {
  const rows = await query(
    `SELECT id, job_type, payload
     FROM ingestion_jobs
     WHERE status = 'queued'
     ORDER BY JSON_EXTRACT(payload, '$.priority') ASC, created_at ASC
     LIMIT 1`
  );
  return rows[0] || null;
}

async function markRetry(jobId, payload, errorMessage) {
  const retryState = computeRetryState(payload);
  if (retryState.shouldFail) {
    await query('UPDATE ingestion_jobs SET status = \'failed\', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      errorMessage,
      jobId
    ]);
    return;
  }

  const nextPayload = { ...payload, retries: retryState.retries, retryAfterMs: retryState.retryAfterMs };
  await query(
    `UPDATE ingestion_jobs
     SET status = 'queued', error_message = ?, payload = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [errorMessage, JSON.stringify(nextPayload), jobId]
  );
}

async function saveCheckpoint(jobId, key, value) {
  await query(
    `INSERT INTO ingestion_checkpoints (ingestion_job_id, checkpoint_key, checkpoint_value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE checkpoint_value = VALUES(checkpoint_value), created_at = CURRENT_TIMESTAMP`,
    [jobId, key, String(value)]
  );
}

async function loadCheckpoint(jobId, key) {
  const rows = await query(
    `SELECT checkpoint_value
     FROM ingestion_checkpoints
     WHERE ingestion_job_id = ? AND checkpoint_key = ?
     LIMIT 1`,
    [jobId, key]
  );
  return rows[0]?.checkpoint_value ?? null;
}

async function persistDatasetVersion({
  jobId,
  datasetName,
  parsedRows,
  rows,
  duplicateCount,
  sourceSystem,
  sourcePath,
  transformations
}) {
  const missingFieldsRate = getMissingFieldsRate(rows);
  const duplicateRate = parsedRows.length ? Number((duplicateCount / parsedRows.length).toFixed(5)) : 0;

  const versionNo = await nextDatasetVersion(datasetName);
  await query(
    `INSERT INTO dataset_versions
      (ingestion_job_id, dataset_name, version_no, records_written, missing_fields_rate, duplicate_rate, lineage)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      jobId,
      datasetName,
      versionNo,
      rows.length,
      missingFieldsRate,
      duplicateRate,
      JSON.stringify({
        sourceSystem,
        sourcePath,
        transformations,
        checkpoints: ['parsed', 'normalized', 'deduped']
      })
    ]
  );

  const vrows = await query('SELECT LAST_INSERT_ID() AS id');
  const datasetVersionId = vrows[0].id;

  const snapshot = buildCheckpointSnapshot({
    parsedRows: parsedRows.length,
    writtenRows: rows.length,
    versionNo
  });
  await saveCheckpoint(jobId, 'rows_parsed', snapshot.rows_parsed);
  await saveCheckpoint(jobId, 'rows_written', snapshot.rows_written);
  await saveCheckpoint(jobId, 'dataset_version', snapshot.dataset_version);
  await saveCheckpoint(jobId, 'last_processed_row', snapshot.last_processed_row);

  const baseline = await baselineMetrics(datasetName);
  if (baseline.count >= 14) {
    const missingDev = deviationPercent(missingFieldsRate, baseline.missing);
    const duplicateDev = deviationPercent(duplicateRate, baseline.duplicate);

    if (missingDev > 2) {
      await query(
        `INSERT INTO quality_alerts
          (ingestion_job_id, dataset_version_id, metric_name, baseline_value, current_value, deviation_percent)
         VALUES (?, ?, 'missing_fields_rate', ?, ?, ?)`,
        [jobId, datasetVersionId, baseline.missing, missingFieldsRate, missingDev]
      );
    }

    if (duplicateDev > 2) {
      await query(
        `INSERT INTO quality_alerts
          (ingestion_job_id, dataset_version_id, metric_name, baseline_value, current_value, deviation_percent)
         VALUES (?, ?, 'duplicate_rate', ?, ?, ?)`,
        [jobId, datasetVersionId, baseline.duplicate, duplicateRate, duplicateDev]
      );
    }
  }
}

async function processCsvJob(jobId, payload) {
  const csvPath = payload.csvPath;
  const datasetName = payload.datasetName || 'inspection_ingest';
  if (!csvPath || !fs.existsSync(csvPath)) {
    throw new Error('CSV source not found');
  }

  const content = fs.readFileSync(path.resolve(csvPath), 'utf8');
  const parsed = parseCsv(content);
  const resumeFromRaw = await loadCheckpoint(jobId, 'last_processed_row');
  const resumeFrom = Math.max(0, Number(resumeFromRaw || 0));
  const resumeSlice = parsed.slice(resumeFrom);
  const normalized = resumeSlice.map(normalizedRow);
  const { rows, duplicateCount } = dedupeRows(normalized);
  await persistDatasetVersion({
    jobId,
    datasetName,
    parsedRows: resumeSlice,
    rows,
    duplicateCount,
    sourceSystem: payload.sourceSystem || 'csv',
    sourcePath: csvPath,
    transformations: ['miles_to_km', 'currency_to_usd', 'deterministic_dedupe']
  });
}

async function processDeviceExportJob(jobId, payload) {
  const exportPath = payload.deviceExportPath || payload.sourcePath;
  const datasetName = payload.datasetName || 'device_export_ingest';
  if (!exportPath || !fs.existsSync(exportPath)) {
    throw new Error('Device export source not found');
  }

  const content = fs.readFileSync(path.resolve(exportPath), 'utf8');
  const ext = path.extname(exportPath).toLowerCase();
  const parsed = ext === '.json' ? parseJsonRows(content) : parseCsv(content);
  const resumeFromRaw = await loadCheckpoint(jobId, 'last_processed_row');
  const resumeFrom = Math.max(0, Number(resumeFromRaw || 0));
  const resumeSlice = parsed.slice(resumeFrom);
  const normalized = resumeSlice.map((row) => normalizedRow(normalizeDeviceExportRow(row)));
  const { rows, duplicateCount } = dedupeRows(normalized);

  await saveCheckpoint(jobId, 'connector', CONNECTOR_DEVICE_EXPORT);
  await saveCheckpoint(jobId, 'source_path', exportPath);
  await persistDatasetVersion({
    jobId,
    datasetName,
    parsedRows: resumeSlice,
    rows,
    duplicateCount,
    sourceSystem: payload.sourceSystem || 'device_export',
    sourcePath: exportPath,
    transformations: ['device_export_mapping', 'miles_to_km', 'currency_to_usd', 'deterministic_dedupe']
  });
}

async function processNetworkShareStub(jobId, payload) {
  const sourcePath = payload?.sourcePath || payload?.networkSharePath;
  const datasetName = payload?.datasetName || 'network_share_ingest';
  
  if (!sourcePath) {
    throw new Error('Network share path is required');
  }

  // Resolve the network share path
  const resolvedPath = path.resolve(sourcePath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Network share path not found: ${sourcePath}`);
  }

  await saveCheckpoint(jobId, 'connector', CONNECTOR_NETWORK_SHARE_STUB);
  await saveCheckpoint(jobId, 'source_path', sourcePath);
  await saveCheckpoint(jobId, 'dataset_name', datasetName);

  // Get checkpoint for resumption
  const lastProcessedFile = await loadCheckpoint(jobId, 'last_processed_file');
  const processedFiles = new Set(lastProcessedFile ? lastProcessedFile.split(',') : []);

  // Enumerate files in the network share
  const files = fs.readdirSync(resolvedPath)
    .filter(f => {
      const ext = path.extname(f).toLowerCase();
      return (ext === '.csv' || ext === '.json') && !processedFiles.has(f);
    })
    .map(f => path.join(resolvedPath, f));

  if (files.length === 0) {
    await saveCheckpoint(jobId, 'records_scanned', 0);
    return;
  }

  let allParsedRows = [];
  const newlyProcessed = [];

  // Process each file
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    const parsed = ext === '.json' ? parseJsonRows(content) : parseCsv(content);
    allParsedRows = allParsedRows.concat(parsed);
    newlyProcessed.push(path.basename(filePath));
  }

  // Apply transformations
  const normalized = allParsedRows.map(normalizedRow);
  const { rows, duplicateCount } = dedupeRows(normalized);

  // Persist dataset version with lineage
  await persistDatasetVersion({
    jobId,
    datasetName,
    parsedRows: allParsedRows,
    rows,
    duplicateCount,
    sourceSystem: payload.sourceSystem || 'network_share',
    sourcePath,
    transformations: ['network_share_enumeration', 'miles_to_km', 'currency_to_usd', 'deterministic_dedupe']
  });

  // Update checkpoint with processed files
  processedFiles.add(...newlyProcessed);
  await saveCheckpoint(jobId, 'last_processed_file', Array.from(processedFiles).join(','));
  await saveCheckpoint(jobId, 'records_scanned', allParsedRows.length);
}

const connectorRegistry = new Map([
  [CONNECTOR_CSV, processCsvJob],
  [CONNECTOR_DEVICE_EXPORT, processDeviceExportJob],
  [CONNECTOR_NETWORK_SHARE_STUB, processNetworkShareStub]
]);

export function registerIngestionConnector(connectorName, runner) {
  const name = String(connectorName || '').trim();
  if (!name) throw new Error('connectorName is required');
  if (typeof runner !== 'function') throw new Error('runner must be a function');
  connectorRegistry.set(name, runner);
}

function resolveConnector(jobType, payload) {
  const explicit = String(payload?.connector || '').trim();
  if (explicit && connectorRegistry.has(explicit)) return explicit;
  if (jobType === 'device_export_import') return CONNECTOR_DEVICE_EXPORT;
  if (jobType === 'network_share_import') return CONNECTOR_NETWORK_SHARE_STUB;
  return CONNECTOR_CSV;
}

export async function runIngestionQueueOnce() {
  const next = await pickNextJob();
  if (!next) return { processed: false };

  const jobId = next.id;
  const jobType = next.job_type;
  const payload = typeof next.payload === 'string' ? JSON.parse(next.payload) : next.payload || {};

  if (!(await dependenciesSatisfied(jobId))) {
    return { processed: false, blockedByDependency: true, jobId };
  }

  await query(
    `UPDATE ingestion_jobs
     SET status = 'running', started_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [jobId]
  );

  try {
    const connector = resolveConnector(jobType, payload);
    const runner = connectorRegistry.get(connector);
    if (!runner) throw new Error(`Connector not registered: ${connector}`);
    await runner(jobId, payload);
    await query(
      `UPDATE ingestion_jobs
       SET status = 'completed', finished_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [jobId]
    );
    return { processed: true, jobId, status: 'completed', connector };
  } catch (err) {
    await markRetry(jobId, payload, err.message);
    return { processed: true, jobId, status: 'retry_or_failed', error: err.message };
  }
}

export const _testables = {
  milesToKilometers,
  convertToUsd,
  deterministicKey,
  dedupeRows,
  deviationPercent,
  pickJobByPriority,
  computeRetryState,
  buildCheckpointSnapshot,
  MAX_RETRIES
};
