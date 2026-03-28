import fs from 'fs';
import http from 'http';
import https from 'https';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import { config } from './config.js';
import { query } from './db.js';
import { rateLimit } from './middleware/rateLimit.js';
import { authOptional } from './middleware/auth.js';
import { safeLog } from './utils/redaction.js';
import { startIngestionScheduler } from './services/ingestionSchedulerService.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import securityRoutes from './routes/security.js';
import coordinatorRoutes from './routes/coordinator.js';
import ingestionRoutes from './routes/ingestion.js';
import searchRoutes from './routes/search.js';
import messagesRoutes from './routes/messages.js';
import filesRoutes from './routes/files.js';
import complianceRoutes from './routes/compliance.js';
import usersRoutes from './routes/users.js';
import rolesRoutes from './routes/roles.js';
import auditRoutes from './routes/audit.js';
import inspectionsRoutes from './routes/inspections.js';

const app = new Koa();

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    safeLog('request_error', {
      method: ctx.method,
      url: ctx.url,
      error: error.message,
      stack: error.stack
    });
    ctx.status = error.status || 500;
    ctx.body = { error: 'Internal Server Error' };
  }
});

app.use(
  cors({
    origin: (ctx) => {
      const reqOrigin = ctx.request.header.origin;
      if (!reqOrigin) return '*';
      return reqOrigin === 'http://localhost:5173' ? reqOrigin : '';
    }
  })
);
app.use(bodyParser({ enableTypes: ['json'] }));
app.use(authOptional);

app.use(async (ctx, next) => {
  const unsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(ctx.method);
  if (!unsafeMethod) {
    await next();
    return;
  }

  if (ctx.path === '/api/auth/login') {
    await next();
    return;
  }

  const authHeader = ctx.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearerToken) {
    await next();
    return;
  }

  const csrfToken = String(ctx.headers['x-csrf-token'] || '');
  if (!csrfToken || csrfToken !== bearerToken) {
    ctx.status = 403;
    ctx.body = { error: 'CSRF token validation failed' };
    return;
  }

  await next();
});

app.use(rateLimit);

app.use(healthRoutes.routes()).use(healthRoutes.allowedMethods());
app.use(authRoutes.routes()).use(authRoutes.allowedMethods());
app.use(dashboardRoutes.routes()).use(dashboardRoutes.allowedMethods());
app.use(securityRoutes.routes()).use(securityRoutes.allowedMethods());
app.use(coordinatorRoutes.routes()).use(coordinatorRoutes.allowedMethods());
app.use(ingestionRoutes.routes()).use(ingestionRoutes.allowedMethods());
app.use(searchRoutes.routes()).use(searchRoutes.allowedMethods());
app.use(messagesRoutes.routes()).use(messagesRoutes.allowedMethods());
app.use(filesRoutes.routes()).use(filesRoutes.allowedMethods());
app.use(complianceRoutes.routes()).use(complianceRoutes.allowedMethods());
app.use(usersRoutes.routes()).use(usersRoutes.allowedMethods());
app.use(rolesRoutes.routes()).use(rolesRoutes.allowedMethods());
app.use(auditRoutes.routes()).use(auditRoutes.allowedMethods());
app.use(inspectionsRoutes.routes()).use(inspectionsRoutes.allowedMethods());

function createServer() {
  if (!config.tls.enabled) {
    return http.createServer(app.callback());
  }

  if (!fs.existsSync(config.tls.certPath) || !fs.existsSync(config.tls.keyPath)) {
    throw new Error(`TLS enabled but cert files not found at ${config.tls.certPath} and ${config.tls.keyPath}`);
  }

  return https.createServer(
    {
      cert: fs.readFileSync(config.tls.certPath),
      key: fs.readFileSync(config.tls.keyPath)
    },
    app.callback()
  );
}

async function ensureSchemaCompatibility() {
  const logsTableRows = await query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'audit_logs'`
  );
  const eventsTableRows = await query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'audit_events'`
  );

  const hasAuditLogs = Number(logsTableRows[0]?.total || 0) > 0;
  const hasAuditEvents = Number(eventsTableRows[0]?.total || 0) > 0;
  if (hasAuditLogs && !hasAuditEvents) {
    await query('RENAME TABLE audit_logs TO audit_events');
  }

  await query(
    `CREATE TABLE IF NOT EXISTS audit_events (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_user_id BIGINT UNSIGNED NULL,
      actor_role VARCHAR(64) NULL,
      action VARCHAR(120) NOT NULL,
      target_table VARCHAR(120) NOT NULL,
      target_record_id VARCHAR(120) NULL,
      location_code VARCHAR(32) NULL,
      department_code VARCHAR(32) NULL,
      event_hash CHAR(64) NULL,
      details JSON NULL,
      INDEX idx_audit_event_time (event_time),
      INDEX idx_audit_scope (location_code, department_code)
    ) ENGINE=InnoDB`
  );

  const userColumns = [
    { name: 'location_code', ddl: "ADD COLUMN location_code VARCHAR(32) NOT NULL DEFAULT 'HQ'" },
    { name: 'department_code', ddl: "ADD COLUMN department_code VARCHAR(32) NOT NULL DEFAULT 'OPS'" },
    { name: 'team_id', ddl: 'ADD COLUMN team_id VARCHAR(32) NULL' }
  ];

  for (const column of userColumns) {
    const columnRows = await query(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'users'
         AND column_name = ?`,
      [column.name]
    );

    const hasColumn = Number(columnRows[0]?.total || 0) > 0;
    if (!hasColumn) {
      await query(`ALTER TABLE users ${column.ddl}`);
    }
  }
}

async function bootstrap() {
  // Runtime schema guard: keep compatibility with DBs initialized from repo/backend/db/init.sql
  await ensureSchemaCompatibility();
  await startIngestionScheduler();
  const server = createServer();
  server.listen(config.port, () => {
    safeLog('backend_started', { port: config.port, tlsEnabled: config.tls.enabled });
  });
}

bootstrap().catch((error) => {
  safeLog('backend_startup_failed', { error: error.message, stack: error.stack });
  process.exit(1);
});
