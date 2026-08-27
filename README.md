# Pennant

Single file storefront. Open `index.html` in a browser.

## Structure

Three views, hash routed, no build step:

- `#store` products first: featured shelf, category filter, product grid, ordering steps, call band
- `#contact` phone, hours, and a request form that opens WhatsApp
- `#admin` passcode gate, product add and edit, JSON export and import

The bag drawer and footer are global.

## Photos

Product photos come from a keyword placeholder service so nothing renders empty:

```
https://loremflickr.com/800/800/{tags}?lock={n}
```

Every product carries `tags` and a `lock` number so the same photo comes back each load. Paste a link into a product's `img` field (or the Image URL box in admin) and it overrides the placeholder. If a photo fails to load, the tile falls back to a plain grey block rather than a broken icon.

Replace these with real photography before launch. It is the single biggest upgrade the page can get.

## Backend contract

Four functions in the script are marked `API`. Swap the bodies for fetch calls, nothing else changes.

| Function | Route | Body |
| --- | --- | --- |
| `loadProducts()` | `GET /api/products` | returns an array |
| `createProduct(p)` | `POST /api/products` | product object |
| `updateProduct(p)` | `PUT /api/products/:id` | product object |
| `deleteProduct(id)` | `DELETE /api/products/:id` | none |

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

## Known gaps

1. The admin passcode (`pennant2026`) is checked in the browser. Move it to the server.
2. Products live in memory, so a refresh restores the starting eight.
3. Checkout opens WhatsApp with the order written out. It does not record the order anywhere yet.
4. Image upload is a pasted URL, not a file picker.

## Logo

Both logo files are keyed out onto transparency and embedded in the page as data URIs, so `index.html` works on its own with no asset folder. Full resolution copies are in `assets/`:

- `assets/pennant-mark.png` the container P, used in the nav and as the favicon
- `assets/pennant-lockup.png` the full wordmark, used in the footer

If you would rather serve them as files, drop the folder next to `index.html` and swap the two long `data:image/webp;base64,` values for `assets/pennant-mark.png` and `assets/pennant-lockup.png`. That cuts about 37KB off the HTML.

## Design notes, so edits stay consistent

- Type is Inter, weights 400 to 600 only. Headings 600, never 700.
- Colours: text `#1d1d1f`, secondary `#6e6e73`, section tint `#f5f5f7`, one accent blue `#1d4384`, sampled off the wordmark. Nothing else.
- Buttons are pills, `border-radius:980px`, three variants: blue, quiet grey, outline.
- Icons are one set in the SVG sprite at the top of the body, all 1.6 stroke. Add new ones there, do not paste in a different icon style.
- Motion is one gesture repeated: an 18px rise with a fade. Reduced motion turns it off.
