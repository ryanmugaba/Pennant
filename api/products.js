const { sql, ensureSchema } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
const { normalizeProduct } = require('../lib/products');

module.exports = async function handler(req, res) {
  await ensureSchema();

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM products ORDER BY id`;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const p = normalizeProduct(req.body, (req.body && req.body.id) || 'p' + Date.now());
    if (!p.name) return res.status(400).json({ error: 'Name is required' });
    await sql`
      INSERT INTO products (id, name, cat, price, stock, img, "desc", tags, "lock", featured)
      VALUES (${p.id}, ${p.name}, ${p.cat}, ${p.price}, ${p.stock}, ${p.img}, ${p.desc}, ${p.tags}, ${p.lock}, ${p.featured})
    `;
    return res.status(201).json(p);
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed' });
};
