import Router from 'koa-router';
import { pingDb } from '../db.js';

const router = new Router();

router.get('/health', async (ctx) => {
  try {
    await pingDb();
    ctx.body = { status: 'ok', database: 'ok', ts: new Date().toISOString() };
  } catch (error) {
    ctx.status = 503;
    ctx.body = { status: 'degraded', database: 'unavailable', error: error.message };
  }
});

export default router;
