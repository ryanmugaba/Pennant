const crypto = require('crypto');

const SESSION_COOKIE = 'pennant_admin';
const SESSION_MAX_AGE = 60 * 60 * 8; // seconds (8 hours)

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parseCookie(header) {
  const out = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return out;
}

function stringifySetCookie({ name, value, httpOnly, sameSite, secure, maxAge, path }) {
  let str = `${name}=${encodeURIComponent(value)}`;
  if (path) str += `; Path=${path}`;
  if (typeof maxAge === 'number') str += `; Max-Age=${Math.floor(maxAge)}`;
  if (sameSite) str += `; SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`;
  if (secure) str += '; Secure';
  if (httpOnly) str += '; HttpOnly';
  return str;
}

function sign(value, secret) {
  const sig = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  return `${value}.${sig}`;
}

function verify(signedValue, secret) {
  if (!signedValue) return null;
  const idx = signedValue.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signedValue.slice(0, idx);
  const sig = signedValue.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

function isAdmin(req) {
  const secret = requiredEnv('SESSION_SECRET');
  const cookies = parseCookie(req.headers.cookie || '');
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return false;
  return verify(raw, secret) === 'ok';
}

/** Returns true if the request is an authenticated admin; otherwise writes a 401 and returns false. */
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  res.status(401).json({ error: 'Not signed in' });
  return false;
}

function setSessionCookie(res) {
  const secret = requiredEnv('SESSION_SECRET');
  const signed = sign('ok', secret);
  res.setHeader('Set-Cookie', stringifySetCookie({
    name: SESSION_COOKIE,
    value: signed,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/'
  }));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', stringifySetCookie({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/'
  }));
}

/* ---------- customer accounts (separate cookie from the staff session) ---------- */

const USER_COOKIE = 'pennant_user';
const USER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function currentUserId(req) {
  const secret = requiredEnv('SESSION_SECRET');
  const raw = parseCookie(req.headers.cookie || '')[USER_COOKIE];
  const value = verify(raw, secret);
  if (!value || !value.startsWith('u:')) return null;
  const id = Number(value.slice(2));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function setUserCookie(res, userId) {
  const secret = requiredEnv('SESSION_SECRET');
  res.setHeader('Set-Cookie', stringifySetCookie({
    name: USER_COOKIE, value: sign('u:' + userId, secret), httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', maxAge: USER_MAX_AGE, path: '/'
  }));
}

function clearUserCookie(res) {
  res.setHeader('Set-Cookie', stringifySetCookie({
    name: USER_COOKIE, value: '', httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/'
  }));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function checkPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt:')) return false;
  const [, salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(password, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  isAdmin, requireAdmin, setSessionCookie, clearSessionCookie, requiredEnv,
  currentUserId, setUserCookie, clearUserCookie, hashPassword, checkPassword
};
