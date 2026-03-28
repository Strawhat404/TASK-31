import Router from 'koa-router';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = new Router({ prefix: '/api/roles' });

router.get('/', authRequired, requireRoles('Administrator'), async (ctx) => {
  const rows = await query('SELECT id, name, description FROM roles ORDER BY name ASC');
  ctx.body = { roles: rows };
});

export default router;
