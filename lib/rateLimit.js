const { sql } = require('./db');

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const PRUNE_SECONDS = 600; // keep a bit longer than the check window, then sweep

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/**
 * Records this login attempt and reports whether the IP is currently over
 * the limit. express-rate-limit (the previous implementation) counted every
 * request regardless of outcome, so this does too — call it once per
 * POST /api/login, before checking the passcode.
 */
async function checkLoginRateLimit(req) {
  const ip = getClientIp(req);

  await sql`DELETE FROM login_attempts WHERE attempted_at < now() - make_interval(secs => ${PRUNE_SECONDS})`;
  await sql`INSERT INTO login_attempts (ip) VALUES (${ip})`;

  const { rows } = await sql`
    SELECT COUNT(*)::int AS n FROM login_attempts
    WHERE ip = ${ip} AND attempted_at > now() - make_interval(secs => ${WINDOW_SECONDS})
  `;

  return { limited: rows[0].n > MAX_ATTEMPTS };
}

module.exports = { checkLoginRateLimit };
