// Customer accounts, one function to stay well inside the Hobby plan's function limit.
//   GET  /api/account?action=me       -> { user, googleClientId }
//   GET  /api/account?action=orders   -> { orders } for the signed-in customer
//   POST /api/account?action=signup   { id, password, name }
//   POST /api/account?action=login    { id, password }
//   POST /api/account?action=google   { credential }  (Google Identity Services ID token)
//   POST /api/account?action=logout
const { sql, ensureSchema } = require('../lib/db');
const { checkLoginRateLimit } = require('../lib/rateLimit');
const { currentUserId, setUserCookie, clearUserCookie, hashPassword, checkPassword } = require('../lib/auth');

const publicUser = u => u && { id: u.id, name: u.name, email: u.email || u.username };

async function getUser(id) {
  if (!id) return null;
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  await ensureSchema();
  const action = String((req.query && req.query.action) || '');
  const body = req.body || {};

  if (req.method === 'GET' && action === 'me') {
    const user = await getUser(currentUserId(req));
    return res.status(200).json({ user: publicUser(user), googleClientId: process.env.GOOGLE_CLIENT_ID || null });
  }

  if (req.method === 'GET' && action === 'orders') {
    const id = currentUserId(req);
    if (!id) return res.status(401).json({ error: 'Not signed in' });
    const { rows } = await sql`SELECT id, created_at, items, total, status FROM orders WHERE user_id = ${id} ORDER BY id DESC LIMIT 50`;
    return res.status(200).json({ orders: rows });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (action === 'logout') {
    clearUserCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (action === 'signup' || action === 'login') {
    const { limited } = await checkLoginRateLimit(req, 'acct:');
    if (limited) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });

    const raw = String(body.id || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!raw || !password) return res.status(400).json({ error: 'Enter your email or username and a password.' });
    const isEmail = raw.includes('@');

    if (action === 'signup') {
      const name = String(body.name || '').trim().slice(0, 80);
      if (password.length < 8) return res.status(400).json({ error: 'Use at least 8 characters for the password.' });
      if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return res.status(400).json({ error: 'That email does not look right.' });
      if (!isEmail && !/^[a-z0-9._-]{3,32}$/.test(raw)) return res.status(400).json({ error: 'Usernames are 3 to 32 letters, numbers, dots or dashes.' });
      const { rows: taken } = await sql`SELECT 1 FROM users WHERE email = ${raw} OR username = ${raw}`;
      if (taken.length) return res.status(409).json({ error: 'An account already uses that. Try signing in.' });
      const { rows } = await sql`
        INSERT INTO users (email, username, name, password_hash)
        VALUES (${isEmail ? raw : null}, ${isEmail ? null : raw}, ${name || null}, ${hashPassword(password)})
        RETURNING *`;
      setUserCookie(res, rows[0].id);
      return res.status(201).json({ user: publicUser(rows[0]) });
    }

    const { rows } = await sql`SELECT * FROM users WHERE email = ${raw} OR username = ${raw} LIMIT 1`;
    const user = rows[0];
    if (!user || !checkPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'That email or password is not right.' });
    }
    setUserCookie(res, user.id);
    return res.status(200).json({ user: publicUser(user) });
  }

  if (action === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'Google sign in is not set up.' });
    const credential = String(body.credential || '');
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    const info = r.ok ? await r.json() : null;
    if (!info || info.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) {
      return res.status(401).json({ error: 'Google could not confirm that sign in.' });
    }
    const email = info.email_verified === 'true' || info.email_verified === true ? String(info.email).toLowerCase() : null;
    let { rows } = await sql`SELECT * FROM users WHERE google_sub = ${info.sub} LIMIT 1`;
    let created = false;
    if (!rows.length && email) {
      ({ rows } = await sql`UPDATE users SET google_sub = ${info.sub} WHERE email = ${email} RETURNING *`);
    }
    if (!rows.length) {
      ({ rows } = await sql`
        INSERT INTO users (email, name, google_sub) VALUES (${email}, ${info.name || null}, ${info.sub}) RETURNING *`);
      created = true;
    }
    setUserCookie(res, rows[0].id);
    return res.status(200).json({ user: publicUser(rows[0]), created });
  }

  res.status(400).json({ error: 'Unknown action' });
};
