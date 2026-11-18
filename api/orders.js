const { sql, ensureSchema } = require('../lib/db');
const { requireAdmin, currentUserId } = require('../lib/auth');

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

module.exports = async function handler(req, res) {
  await ensureSchema();

  if (req.method === 'POST') {
    const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
    const { rows: catalogue } = await sql`SELECT * FROM products`;
    const lines = [];
    let total = 0;

    for (const line of items) {
      const p = catalogue.find((x) => x.id === line.id);
      if (!p) continue;
      const qty = Math.min(Math.max(1, Math.floor(Number(line.qty)) || 1), Math.max(1, p.stock));
      lines.push({ id: p.id, name: p.name, price: p.price, qty });
      total += p.price * qty;
    }

    if (!lines.length) return res.status(400).json({ error: 'No valid items' });

    const c = (req.body && req.body.customer) || {};
    const customer = {
      name: clip(c.name, 80), phone: clip(c.phone, 40), email: clip(c.email, 120),
      method: clip(c.method, 20), payment: clip(c.payment, 20),
      city: clip(c.city, 80), suburb: clip(c.suburb, 80), address: clip(c.address, 200), notes: clip(c.notes, 500)
    };
    let userId = null;
    try { userId = currentUserId(req); } catch (e) { userId = null; }

    const { rows } = await sql`
      INSERT INTO orders (items, total, customer, user_id)
      VALUES (${JSON.stringify(lines)}::jsonb, ${total}, ${JSON.stringify(customer)}::jsonb, ${userId})
      RETURNING id, created_at, items, total, status
    `;
    return res.status(201).json(rows[0]);
  }

  if (req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const { rows } = await sql`SELECT * FROM orders ORDER BY id DESC`;
    return res.status(200).json(rows);
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed' });
};
