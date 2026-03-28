const ADMIN = 'Administrator';

export function requireRoles(...allowedRoles) {
  const allowed = new Set(allowedRoles);
  return async (ctx, next) => {
    const user = ctx.state.user;
    if (!user) {
      ctx.status = 401;
      ctx.body = { error: 'Unauthorized' };
      return;
    }

    if (!allowed.has(user.role)) {
      ctx.status = 403;
      ctx.body = { error: 'Insufficient role permissions' };
      return;
    }

    await next();
  };
}

export function enforceScope(options = {}) {
  const {
    locationField = 'location_code',
    departmentField = 'department_code',
    teamField = 'team_id'
  } = options;
  return async (ctx, next) => {
    const user = ctx.state.user;
    if (!user) {
      ctx.status = 401;
      ctx.body = { error: 'Unauthorized' };
      return;
    }

    if (user.role === ADMIN) {
      await next();
      return;
    }

    const requestLocation =
      ctx.query.location ||
      ctx.request.body?.location_code ||
      ctx.request.body?.filters?.location_code;
    const requestDepartment =
      ctx.query.department ||
      ctx.request.body?.department_code ||
      ctx.request.body?.filters?.department_code;
    const requestTeam =
      ctx.query.team ||
      ctx.request.body?.team_id ||
      ctx.request.body?.filters?.team_id;

    if (requestLocation && requestLocation !== user.locationCode) {
      ctx.status = 403;
      ctx.body = { error: `Location scope violation (${locationField})` };
      return;
    }

    if (requestDepartment && requestDepartment !== user.departmentCode) {
      ctx.status = 403;
      ctx.body = { error: `Department scope violation (${departmentField})` };
      return;
    }

    if (requestTeam && requestTeam !== user.teamId) {
      ctx.status = 403;
      ctx.body = { error: `Team scope violation (${teamField})` };
      return;
    }

    await next();
  };
}
