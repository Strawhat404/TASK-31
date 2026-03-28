import Router from 'koa-router';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { exportAuditLedger, purgeExpiredAuditEvents } from '../services/auditRetentionService.js';

const router = new Router({ prefix: '/api/audit-events' });

function parsePage(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

router.get('/', authRequired, requireRoles('Administrator'), async (ctx) => {
  const page = parsePage(ctx.query.page, 1);
  const pageSize = Math.min(parsePage(ctx.query.pageSize, 25), 100);
  const offset = (page - 1) * pageSize;

  const actorRole = typeof ctx.query.actor_role === 'string' ? ctx.query.actor_role.trim() : '';
  const action = typeof ctx.query.action === 'string' ? ctx.query.action.trim() : '';
  const targetTable = typeof ctx.query.target_table === 'string' ? ctx.query.target_table.trim() : '';

  let where = ' WHERE 1 = 1 ';
  const params = [];

  if (actorRole) {
    where += ' AND actor_role = ?';
    params.push(actorRole);
  }

  if (action) {
    where += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }

  if (targetTable) {
    where += ' AND target_table = ?';
    params.push(targetTable);
  }

  const countRows = await query(`SELECT COUNT(*) AS total FROM audit_events ${where}`, [...params]);
  const rows = await query(
    `SELECT id, event_time, actor_user_id, actor_role, action, target_table, target_record_id,
            location_code, department_code, details
     FROM audit_events
     ${where}
     ORDER BY event_time DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const total = Number(countRows[0]?.total || 0);

  ctx.body = {
    rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
});

router.post('/export', authRequired, requireRoles('Administrator'), async (ctx) => {
  const outputDir = typeof ctx.request.body?.output_dir === 'string' ? ctx.request.body.output_dir : '/tmp';
  const result = await exportAuditLedger({ outputDir });
  ctx.body = result;
});

router.post('/retention/purge', authRequired, requireRoles('Administrator'), async (ctx) => {
  const result = await purgeExpiredAuditEvents();
  ctx.body = result;
});

export default router;
