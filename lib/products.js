function normalizeProduct(body, id) {
  const b = body || {};
  return {
    id: id || String(b.id || ''),
    name: String(b.name || '').trim(),
    cat: String(b.cat || 'General').trim(),
    price: Number(b.price) || 0,
    stock: Number(b.stock) || 0,
    img: b.img ? String(b.img).trim() : '',
    desc: b.desc ? String(b.desc).trim() : 'Ask us for the full specification.',
    tags: b.tags ? String(b.tags).trim() : 'product',
    lock: Number.isFinite(Number(b.lock)) ? Number(b.lock) : Math.floor(Math.random() * 900) + 1,
    featured: b.featured ? String(b.featured).trim() : null
  };
}

module.exports = { normalizeProduct };
