# Pennant

Storefront backed by Vercel serverless functions and Postgres for products and orders, plus a separate, unlisted staff page for managing them. No persistent server process and no local filesystem writes — everything state-bearing lives in Postgres, which is what Vercel's free tier requires.

## Running it

```
npm install
cp .env.example .env   # then set ADMIN_PASSCODE, SESSION_SECRET, POSTGRES_URL
vercel dev
```

`vercel dev` (the Vercel CLI — install it globally with `npm i -g vercel`, or run via `npx vercel dev`) serves `index.html` / `pennant-ops.html` as static files and runs every file under `api/` as its own serverless function, matching how it behaves once deployed.

All three env vars are required — every function that touches auth or the database throws immediately if `ADMIN_PASSCODE`, `SESSION_SECRET`, or `POSTGRES_URL` is missing (see `lib/auth.js`, `lib/db.js`). Generate a real session secret rather than leaving the placeholder, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

`POSTGRES_URL` points at a Postgres database reachable over Neon's serverless driver (this project uses `@vercel/postgres`, which talks to Neon's HTTP/WebSocket proxy — it does not speak the plain Postgres wire protocol, so it won't connect to an arbitrary local `postgres://` server run via e.g. Docker). This app's code (`lib/db.js`) only ever reads `POSTGRES_URL` — that's the one variable that's actually required. The simplest way to get one: provision a database from the Storage tab in the Vercel dashboard and link it to the project. Linking auto-populates `POSTGRES_URL` plus several related vars Vercel/Neon set as a group (`POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, and similar) — this project doesn't use the rest, but they show up in the dashboard and in `vercel env pull .env` alongside the one that matters. Bringing an existing Neon database (or any Postgres reachable the same way) also works, since it's the same underlying service — just set `POSTGRES_URL` yourself. Tables are created and seeded automatically on first request (`lib/db.js`'s `ensureSchema()`), so there's no separate migration step — just point `POSTGRES_URL` at an empty database and make one request.

## Structure

- `index.html` — the customer-facing storefront, hash routed, no build step:
  - `#store` products first: featured shelf, category filter, product grid, ordering steps, call band
  - `#contact` phone, hours, and a request form that opens WhatsApp

  The bag drawer and footer are global to this page. There is no admin link anywhere in its nav, footer, or markup.
- `pennant-ops.html` — the staff console, served at `/pennant-ops`: passcode gate, product add/edit/delete, JSON export/import, and a read-only orders list. It isn't linked from `index.html`, so it doesn't show up in the nav, footer, or any sitemap. That's obscurity for convenience only — the actual security is the server-side passcode check and session cookie below, so the path being unlisted is not load-bearing on its own.
- `pennant.css` — shared styles for both pages. Edit here so they stay visually consistent; see Design notes below.
- `api/` — one file per serverless function; see Backend contract below for the full route list. Vercel's file-based routing maps `api/products.js` to `/api/products` and `api/products/[id].js` to `/api/products/:id` automatically.
- `lib/` — code shared between functions (`db.js` the Postgres client/schema/seed, `auth.js` the signed-cookie session logic, `rateLimit.js` the login attempt limiter, `products.js` the shared product-shape validation). Nothing under `lib/` is itself a route — only files directly under `api/` are.
- `vercel.json` — one rewrite, so `/pennant-ops` resolves to `pennant-ops.html` without the extension (Vercel's static file serving doesn't do that resolution on its own).

## Photos

Product photos come from a keyword placeholder service so nothing renders empty:

```
https://loremflickr.com/800/800/{tags}?lock={n}
```

Every product carries `tags` and a `lock` number so the same photo comes back each load. Paste a link into a product's `img` field (or the Image URL box in the staff console) and it overrides the placeholder. If a photo fails to load, the tile falls back to a plain grey block rather than a broken icon.

Replace these with real photography before launch. It is the single biggest upgrade the page can get.

## Backend contract

Each route below is its own file under `api/` (see Structure above), backed by Postgres via `lib/db.js`.

### Products

| Route | Auth | Body |
| --- | --- | --- |
| `GET /api/products` | public | returns an array |
| `POST /api/products` | admin session | product object |
| `PUT /api/products/:id` | admin session | product object |
| `DELETE /api/products/:id` | admin session | none |

Product shape:

```json
{
  "id": "p1",
  "name": "450W monocrystalline panel",
  "cat": "Power",
  "price": 96,
  "stock": 40,
  "img": "",
  "desc": "One or two plain lines.",
  "tags": "solar,panel",
  "lock": 3,
  "featured": "Solar"
}
```

`featured` is optional. Any product that has it appears in the top shelf, and the value is the small label above the name.

The staff console's Import button reads a JSON array and upserts it through the routes above (update if the id already exists, create otherwise). It does not delete products that are missing from the file — there's no bulk-replace route, by design, to keep the API surface to the four routes above.

### Orders

| Route | Auth | Body |
| --- | --- | --- |
| `POST /api/orders` | public | `{ "items": [{ "id": "p1", "qty": 2 }, ...] }` |
| `GET /api/orders` | admin session | returns an array, newest first |

Checkout (`#checkout` in `index.html`) posts the bag here right before it opens WhatsApp — WhatsApp is still the real confirmation step, this is just a log. The server looks up each item's current price from the `products` table itself (it does not trust a price from the client), computes the total, and stores `{ id, created_at, items: [{ id, name, price, qty }], total }`. The staff console shows these under Products, newest first, and that list is behind the same session check as the write routes.

### Auth

| Route | Body | Effect |
| --- | --- | --- |
| `POST /api/login` | `{ "passcode": "..." }` | on match with `ADMIN_PASSCODE`, sets a signed, httpOnly `pennant_admin` cookie (8 hour expiry). Rate-limited to 5 attempts per IP per minute — further attempts get `429` until the window rolls over. |
| `POST /api/logout` | none | clears the cookie |
| `GET /api/session` | none | `{ "isAdmin": true/false }`, used by `pennant-ops.html` on load to skip the passcode screen if already signed in |

The cookie is signed with `SESSION_SECRET` using a plain HMAC-SHA256 helper in `lib/auth.js` (Node's built-in `crypto`, not a middleware package) — there's no server-side session store, so the check is just "does this request carry a validly-signed cookie." That statelessness is what makes it work at all across serverless invocations: there's no shared memory to keep a session store in, but a signed cookie needs none — any instance that has `SESSION_SECRET` can verify it. The tradeoff is the same one stateless cookies always have: `POST /api/logout` clears the cookie in the browser, but doesn't invalidate that cookie value server-side, so a copy of it taken before logout would still authenticate until its 8 hour expiry.

Login rate limiting is tracked in Postgres (`lib/rateLimit.js`'s `login_attempts` table), not in-memory — an in-memory counter (like `express-rate-limit`, which is how this worked before the Vercel migration) doesn't hold up across independent serverless invocations, which don't share memory. Client IP comes from `X-Forwarded-For`, which Vercel sets to the real client IP.

## Deploying to Vercel

- Push this repo to GitHub, then import it in Vercel (New Project → pick the repo). No build step is configured (`vercel.json` only declares the `/pennant-ops` rewrite) — Vercel serves `index.html`/`pennant-ops.html`/`pennant.css` as static files and deploys everything under `api/` as functions automatically.
- Provision a Postgres database from the Storage tab and link it to the project. **Auto-injected by that link**: `POSTGRES_URL` (the only one this app's code reads) plus several related vars (`POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, and similar) that this project doesn't use. **Set by hand**, in Project Settings → Environment Variables: `ADMIN_PASSCODE` and `SESSION_SECRET` — nothing links these in automatically, and they must never be committed (`.env` is gitignored).
- Schema + seed: there's no separate migration script to run — `lib/db.js`'s `ensureSchema()` creates the tables and seeds the 8 starting products the first time any function queries the database. Hitting `/api/products` once (e.g. loading the deployed site) is enough to trigger it.

This runs entirely on Vercel's free tier — no persistent disk or paid instance needed, since Postgres (not local disk) is where state lives.

## Known gaps

1. Image upload is a pasted URL, not a file picker.
2. There's a single shared admin passcode, not per-user accounts.
3. `@vercel/postgres` is deprecated upstream (Vercel's own package, not this project) in favor of using `@neondatabase/serverless` directly — it still works and is what was explicitly asked for here, but worth knowing before adding new Postgres code on top of it.

## Logo

Both logo files are keyed out onto transparency and embedded in the page as data URIs, so `index.html` works on its own with no asset folder. Full resolution copies are in `assets/`:

- `assets/pennant-mark.png` the container P, used in the nav and as the favicon
- `assets/pennant-lockup.png` the full wordmark, used in the footer

If you would rather serve them as files, drop the folder next to `index.html` and swap the two long `data:image/webp;base64,` values for `assets/pennant-mark.png` and `assets/pennant-lockup.png`. That cuts about 37KB off the HTML.

## Design notes, so edits stay consistent

- Type is Inter, weights 400 to 600 only. Headings 600, never 700.
- Colours: text `#1d1d1f`, secondary `#6e6e73`, section tint `#f5f5f7`, one accent blue `#1d4384`, sampled off the wordmark. Nothing else.
- Buttons are pills, `border-radius:980px`, three variants: blue, quiet grey, outline.
- Icons are one set in the SVG sprite at the top of `index.html`'s body, all 1.6 stroke. `pennant-ops.html` doesn't use any icons, so it doesn't include the sprite. Add new icons to the sprite in `index.html`, do not paste in a different icon style.
- Motion is one gesture repeated: an 18px rise with a fade. Reduced motion turns it off.
- All shared rules live in `pennant.css`. Edit there, not in a `<style>` block in either page, so the two pages can't drift apart.
