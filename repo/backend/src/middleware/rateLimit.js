import { config } from '../config.js';

const windows = {
  ip: new Map(),
  user: new Map()
};

function currentMinuteKey() {
  return Math.floor(Date.now() / 60000);
}

function incrementCounter(bucket, key) {
  const minuteKey = currentMinuteKey();
  const composite = `${key}:${minuteKey}`;
  const count = (bucket.get(composite) || 0) + 1;
  bucket.set(composite, count);
  return count;
}

function sweepOldEntries(bucket) {
  const minuteKey = currentMinuteKey();
  for (const key of bucket.keys()) {
    const parts = key.split(':');
    const keyMinute = Number(parts[parts.length - 1]);
    if (!Number.isNaN(keyMinute) && keyMinute < minuteKey - 2) {
      bucket.delete(key);
    }
  }
}

setInterval(() => {
  sweepOldEntries(windows.ip);
  sweepOldEntries(windows.user);
}, 45000).unref();

export async function rateLimit(ctx, next) {
  const ip = ctx.ip || ctx.request.ip || 'unknown';
  const ipCount = incrementCounter(windows.ip, ip);

  if (ipCount > config.rateLimits.ipPerMinute) {
    ctx.status = 429;
    ctx.body = { error: 'IP rate limit exceeded' };
    return;
  }

  const userId = ctx.state.user?.id;
  if (userId) {
    const userCount = incrementCounter(windows.user, String(userId));
    if (userCount > config.rateLimits.userPerMinute) {
      ctx.status = 429;
      ctx.body = { error: 'User rate limit exceeded' };
      return;
    }
  }

  await next();
}
