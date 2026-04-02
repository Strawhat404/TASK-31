import Router from 'koa-router';
import { authRequired } from '../middleware/auth.js';
import { enforceScope } from '../middleware/rbac.js';
import { autocomplete, logSearch, searchVehicleRecords, trendingKeywords } from '../services/searchService.js';
import { redactObject, safeLog } from '../utils/redaction.js';

const router = new Router({ prefix: '/api/search' });

router.get('/vehicles', authRequired, enforceScope(), async (ctx) => {
  const filters = {
    query: ctx.query.q || '',
    brand: ctx.query.brand,
    model_year: ctx.query.model_year,
    price_min: ctx.query.price_min,
    price_max: ctx.query.price_max,
    energy_type: ctx.query.energy_type,
    transmission: ctx.query.transmission,
    date_from: ctx.query.date_from,
    date_to: ctx.query.date_to,
    page: ctx.query.page || 1,
    sort_by: ctx.query.sort_by || 'date',
    sort_order: ctx.query.sort_order || 'desc'
  };

  const result = await searchVehicleRecords(filters, ctx.state.user);
  await logSearch(ctx.state.user.id, filters.query || '', filters);

  safeLog('vehicle_search', { actor: ctx.state.user.username, filters });
  ctx.body = ctx.state.user.role === 'Administrator' ? result : redactObject(result);
});

router.get('/autocomplete', authRequired, async (ctx) => {
  const rows = await autocomplete(ctx.query.prefix || '', ctx.state.user);
  ctx.body = { suggestions: rows };
});

router.get('/trending', authRequired, async (ctx) => {
  const rows = await trendingKeywords(ctx.state.user);
  ctx.body = { keywords: rows };
});

export default router;
