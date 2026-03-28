import { query } from '../db.js';

async function loadSessionUser(token) {
  const rows = await query(
    `SELECT s.id AS session_id, s.user_id, s.token, s.expires_at, s.revoked_at,
            u.username, u.full_name, u.location_code, u.department_code, u.team_id,
            r.name AS role_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.token = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP() AND u.is_active = 1`,
    [token]
  );
  if (!rows.length) return null;
  const session = rows[0] || {};
  if (!session.user_id || !session.username || !session.role_name) return null;
  return {
    id: session.user_id,
    username: session.username,
    fullName: session.full_name,
    role: session.role_name,
    locationCode: session.location_code || null,
    departmentCode: session.department_code || null,
    teamId: session.team_id || null,
    sessionId: session.session_id
  };
}

export async function authOptional(ctx, next) {
  const header = ctx.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const user = await loadSessionUser(token);
      if (user) {
        ctx.state.user = user;
      }
    } catch (_error) {
      // Ignore optional hydration errors and allow route-level auth to enforce strict checks.
    }
  }
  await next();
}

export async function authRequired(ctx, next) {
  const header = ctx.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    ctx.status = 401;
    ctx.body = { error: 'Missing bearer token' };
    return;
  }

  try {
    const user = await loadSessionUser(token);
    if (!user) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid or expired session token' };
      return;
    }
    ctx.state.user = user;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: 'Session validation failed' };
    return;
  }

  await next();
}
