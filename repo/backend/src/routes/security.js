import Router from 'koa-router';
import { authRequired } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { config } from '../config.js';

const router = new Router({ prefix: '/api/security' });

router.get('/config', authRequired, requireRoles('Administrator', 'Data Engineer'), async (ctx) => {
  ctx.body = {
    tls: {
      enabled: config.tls.enabled,
      certPath: config.tls.certPath,
      keyPath: config.tls.keyPath,
      note: 'Use locally issued internal PKI certificates for offline deployment.'
    },
    encryptionAtRest: {
      algorithm: 'AES-256',
      placeholderConfigured: Boolean(config.encryption.aes256KeyHex),
      note: 'Column-level encryption hooks should use this key via application layer or MySQL functions.'
    },
    rateLimits: config.rateLimits
  };
});

export default router;
