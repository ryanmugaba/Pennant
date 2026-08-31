const { sql } = require('@vercel/postgres');

const SEED = [
  { id: 'p1', name: '450W monocrystalline panel', cat: 'Power', price: 96, stock: 40,
    desc: 'Aluminium frame, 25 year output warranty, tested before it leaves the yard.',
    img: '', tags: 'solar,panel', lock: 3, featured: 'Solar' },

  { id: 'p2', name: '5kVA hybrid inverter', cat: 'Power', price: 485, stock: 6,
    desc: 'Pure sine wave with MPPT built in. Runs a house or a small shop through a cut.',
    img: '', tags: 'inverter,electrical', lock: 12, featured: null },

  { id: 'p3', name: '12V 100Ah deep cycle battery', cat: 'Power', price: 132, stock: 24,
    desc: 'Sealed lead acid. The standard fit for backup banks and control panels.',
    img: '', tags: 'battery', lock: 5, featured: null },

  { id: 'p4', name: '3.5kVA petrol generator', cat: 'Power', price: 310, stock: 4,
    desc: 'Recoil start, copper wound, about eight hours on a tank at half load.',
    img: '', tags: 'generator,engine', lock: 9, featured: 'Backup power' },

  { id: 'p5', name: '100W LED floodlight', cat: 'Lighting', price: 19, stock: 120,
    desc: 'IP66 housing, cool white, for yards, sites and anywhere that needs to stop being dark.',
    img: '', tags: 'floodlight,light', lock: 7, featured: null },

  { id: 'p6', name: '200 piece tool kit', cat: 'Tools', price: 78, stock: 9,
    desc: 'Chrome vanadium sockets, ratchets, drivers and pliers in a hard case.',
    img: '', tags: 'tools,toolbox', lock: 21, featured: 'Workshop' },

  { id: 'p7', name: 'Hot air rework station', cat: 'Tools', price: 34, stock: 15,
    desc: 'Soldering iron and hot air gun in one unit with digital temperature control.',
    img: '', tags: 'soldering,workshop', lock: 33, featured: null },

  { id: 'p8', name: '1.5kW surface water pump', cat: 'Water', price: 148, stock: 7,
    desc: 'Cast iron body, self priming, for tanks, gardens and small irrigation runs.',
    img: '', tags: 'water,pump', lock: 4, featured: null }
];

let ready;

/**
 * Creates tables if missing and seeds the demo products exactly once, ever.
 * Seeding is gated on a persistent marker row rather than "is the table empty?",
 * so an intentionally emptied catalog stays empty instead of being re-seeded the
 * next time a cold serverless instance boots.
 * Memoized per warm serverless instance so repeat invocations don't redo the work.
 */
function ensureSchema() {
  if (!ready) ready = init();
  return ready;
}

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cat TEXT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      stock INTEGER NOT NULL,
      img TEXT,
      "desc" TEXT,
      tags TEXT,
      "lock" INTEGER,
      featured TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      items JSONB NOT NULL,
      total DOUBLE PRECISION NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      ip TEXT NOT NULL,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `;

  // Seed the demo catalogue only on the very first initialisation, tracked by a
  // persistent marker. Deleting every product in the admin must not bring the
  // placeholders back, so we never re-seed just because the table is empty.
  const { rows: marker } = await sql`SELECT 1 FROM app_meta WHERE key = 'products_seeded'`;
  if (marker.length === 0) {
    const { rows } = await sql`SELECT COUNT(*)::int AS n FROM products`;
    if (rows[0].n === 0) {
      for (const p of SEED) {
        await sql`
          INSERT INTO products (id, name, cat, price, stock, img, "desc", tags, "lock", featured)
          VALUES (${p.id}, ${p.name}, ${p.cat}, ${p.price}, ${p.stock}, ${p.img}, ${p.desc}, ${p.tags}, ${p.lock}, ${p.featured})
        `;
      }
    }
    await sql`
      INSERT INTO app_meta (key, value)
      VALUES ('products_seeded', ${new Date().toISOString()})
      ON CONFLICT (key) DO NOTHING
    `;
  }
}

module.exports = { sql, ensureSchema, SEED };
