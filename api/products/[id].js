const { sql, ensureSchema } = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');
const { normalizeProduct } = require('../../lib/products');

module.exports = async function handler(req, res) {
  await ensureSchema();
  const { id } = req.query;

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const p = normalizeProduct(req.body, id);
    if (!p.name) return res.status(400).json({ error: 'Name is required' });
    const { rowCount } = await sql`
      UPDATE products SET name=${p.name}, cat=${p.cat}, price=${p.price}, stock=${p.stock},
        img=${p.img}, "desc"=${p.desc}, tags=${p.tags}, "lock"=${p.lock}, featured=${p.featured}
      WHERE id=${id}
    `;
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(p);
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const { rowCount } = await sql`DELETE FROM products WHERE id = ${id}`;
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'PUT, DELETE');
  res.status(405).json({ error: 'Method not allowed' });
};
