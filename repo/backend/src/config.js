import dotenv from 'dotenv';

dotenv.config();

function mustHave(name, fallback = '') {
  return process.env[name] || fallback;
}

export const config = {
  port: Number(mustHave('PORT', 4000)),
  nodeEnv: mustHave('NODE_ENV', 'production'),
  db: {
    host: mustHave('DB_HOST', 'mysql'),
    port: Number(mustHave('DB_PORT', 3306)),
    database: mustHave('DB_NAME', 'roadsafe'),
    user: mustHave('DB_USER', 'roadsafe'),
    password: mustHave('DB_PASSWORD', 'roadsafe_password')
  },
  sessionTtlHours: Number(mustHave('SESSION_TTL_HOURS', 8)),
  rateLimits: {
    ipPerMinute: Number(mustHave('IP_RATE_LIMIT_PER_MIN', 300)),
    userPerMinute: Number(mustHave('USER_RATE_LIMIT_PER_MIN', 60))
  },
  ingestion: {
    dropRoot: mustHave('INGEST_DROP_ROOT', '/var/roadsafe/dropzone')
  },
  tls: {
    enabled: String(mustHave('TLS_ENABLED', 'false')).toLowerCase() === 'true',
    certPath: mustHave('TLS_CERT_PATH', './certs/server.crt'),
    keyPath: mustHave('TLS_KEY_PATH', './certs/server.key')
  },
  encryption: {
    // Placeholder only: wiring for AES-256 at-rest encryption for sensitive columns.
    aes256KeyHex: mustHave('AES_256_KEY_HEX', 'PLACEHOLDER_64_HEX_CHARS_FOR_AES_256')
  }
};
