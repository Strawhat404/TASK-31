const MASK = '***REDACTED***';

const SENSITIVE_KEYS = new Set([
  'token',
  'password',
  'password_hash',
  'password_salt',
  'email',
  'recipient',
  'recipient_email',
  'recipient_phone',
  'vin',
  'plate_number',
  'ssn',
  'identifier'
]);

export function redactObject(input) {
  if (!input || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((item) => redactObject(item));

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = MASK;
      continue;
    }
    out[key] = typeof value === 'object' ? redactObject(value) : value;
  }
  return out;
}

export function safeLog(message, meta = {}) {
  const safeMeta = redactObject(meta);
  console.log(message, safeMeta);
}
