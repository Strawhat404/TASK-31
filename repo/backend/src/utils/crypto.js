import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ITERATIONS = 120000;
const KEYLEN = 64;
const DIGEST = 'sha512';

export function validatePasswordComplexity(password) {
  if (typeof password !== 'string' || password.length < 12) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

export function hashPassword(password, salt = null) {
  if (salt === null) {
    const hash = bcrypt.hashSync(password, 12);
    return { salt: null, hash };
  }

  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  if (typeof expectedHash === 'string' && /^\$2[aby]\$\d{2}\$/.test(expectedHash)) {
    return bcrypt.compareSync(password, expectedHash);
  }

  if (!salt) {
    return false;
  }

  const candidate = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  if (candidate.length !== expectedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expectedHash, 'hex'));
}

export function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}
