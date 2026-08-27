const { ensureSchema } = require('../lib/db');
const { checkLoginRateLimit } = require('../lib/rateLimit');
const { setSessionCookie, requiredEnv } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await ensureSchema();

  const { limited } = await checkLoginRateLimit(req);
  if (limited) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
  }

  const adminPasscode = requiredEnv('ADMIN_PASSCODE');
  const passcode = req.body && req.body.passcode;

  if (passcode && passcode === adminPasscode) {
    setSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  res.status(401).json({ error: 'Wrong passcode' });
};
