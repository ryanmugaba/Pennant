const { sql, ensureSchema } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');

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
      const qty = Math.max(1, Math.floor(Number(line.qty)) || 1);
      lines.push({ id: p.id, name: p.name, price: p.price, qty });
      total += p.price * qty;
    }

    if (!lines.length) return res.status(400).json({ error: 'No valid items' });

    const { rows } = await sql`
      INSERT INTO orders (items, total)
      VALUES (${JSON.stringify(lines)}::jsonb, ${total})
      RETURNING id, created_at, items, total
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
