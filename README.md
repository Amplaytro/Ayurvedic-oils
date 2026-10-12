# Vedara — Ayurvedic Oils

A premium storefront for cold-pressed, slow-steeped Ayurvedic oils. Static
HTML/CSS/JS — no build step, no dependencies, no framework. Open `index.html`
and it runs.

```
index.html      Home — hero, collection, botanicals, method, reviews, FAQ
shop.html       Browse — faceted filters, sorting, URL-synced state
product.html    Product detail, rendered from ?id=<productId>
assets/
  css/style.css Design system + every component
  img/*.svg     10 hand-built botanical line-art illustrations
  js/data.js    Catalogue: products, ingredients, FAQs, sizes, store config
  js/cart.js    Cart engine — storage, drawer, badges, toasts
  js/ui.js      Shared UI — header, reveal, accordions, card renderers
  js/home.js    Home page wiring
  js/shop.js    Filter / sort engine
  js/product.js Product detail page wiring
```

## Running it

Opening `index.html` directly works, but a local server is better (avoids
`file://` quirks and makes the product page query string behave consistently):

```powershell
python -m http.server 8000
# then open http://localhost:8000
```

## What's included

**Browse** — Eight products across four categories (hair, skin, body, calm),
filterable by category, concern, skin type and price band, with five sort
orders. Filter state is written to the query string, so
`shop.html?cat=hair&concern=hairfall` is shareable and survives a reload.

**Ingredients** — All ten botanicals (Brahmi, Bhringraj, Tulsi, Neem,
Ashwagandha, Chandan, Amla, Multani Mitti, Kalonji, Aloe) each have their own
illustration, Sanskrit name, Latin binomial, description and what it does.
Every product links its key ingredients back to these.

**Cart** — Slide-in drawer, quantity editing, per-size line items, a
free-shipping progress bar ($60 threshold, $6 flat otherwise), and
`localStorage` persistence. Corrupt or stale stored carts are discarded and
repriced from the catalogue rather than trusted.

**FAQ** — Sixteen questions across four categories, rendered from data as an
accessible accordion. The product page shows the most relevant subset.

## Editing content

Almost everything lives in `assets/js/data.js`:

- `PRODUCTS` — add or edit an oil. Each needs `id`, `name`, `category`,
  `concerns`, `skin`, `price`, `art` (an ingredient key), `short`, `story`,
  `benefits`, `howTo`, `keyIngredients`, `fullIngredients`, `volume`.
- `INGREDIENTS` — add a botanical. `art` on a product points at one of these
  keys, and `image` points at the SVG in `assets/img/`.
- `FAQS` — grouped questions; add a category by adding a group.
- `CONFIG` — free-shipping threshold and flat rate.

Prices scale automatically across the three sizes (Trial / Standard / Ritual)
via the multipliers in `SIZES`. The size a product defaults to is inferred
from its `volume` string, so `volume: "200 ml / 6.76 fl oz"` opens on Ritual.

## Wiring up payments

`data-checkout` in `cart.js` is the single integration point — it currently
shows a confirmation toast. Replace that handler with a redirect to Stripe
Checkout, Shopify's cart permalink, or your own backend:

```js
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-checkout]")) return;
  fetch("/api/checkout", {
    method: "POST",
    body: JSON.stringify(detailed().map(({ id, variant, qty }) => ({ id, variant, qty })))
  }).then(r => r.json()).then(({ url }) => { location.href = url; });
});
```

## Tests

Three headless checks, run with Node (no packages to install):

```powershell
node cart-test.js        # 42 assertions — pricing, cart maths, persistence
node filter-test.js      # 36 assertions — facets, price bands, sorting
node overflow-probe.js   # horizontal overflow at 360–1440px, all pages
```

`overflow-probe.js` and `shoot.js` drive Chrome over the DevTools protocol;
they need Chrome installed and skip gracefully if it is not found.

## Notes

- Fully responsive; verified free of horizontal overflow at 360–1440px.
- Respects `prefers-reduced-motion`.
- Keyboard accessible: visible focus rings, focus trap in the cart drawer,
  `aria-expanded` on accordions, `aria-live` on toasts.
- Product copy, prices, reviews and the clinical claims are illustrative
  placeholder content — replace before going live.