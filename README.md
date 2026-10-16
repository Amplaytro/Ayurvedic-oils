# Vedara — Ayurvedic Oils

A premium storefront for cold-pressed, slow-steeped Ayurvedic oils. Static
HTML/CSS/JS — no build step, no dependencies, no framework. Open `index.html`
and it runs.

```
index.html      Home — hero, collection, botanicals, method, reviews, FAQ
shop.html       Browse — faceted filters, sorting, URL-synced state
product.html    Product detail, rendered from ?id=<productId>
server/
  index.js      Payments API — orders, verification, webhook (+ static files)
  catalog.js    Server-side pricing, loaded from the same data.js the UI uses
assets/
  css/style.css Design system + every component
  img/*.svg     10 hand-built botanical line-art illustrations
  js/data.js    Catalogue: products, ingredients, FAQs, sizes, store config
  js/cart.js    Cart engine — storage, drawer, badges, toasts
  js/checkout.js Razorpay Checkout flow
  js/ui.js      Shared UI — header, reveal, accordions, card renderers
  js/home.js    Home page wiring
  js/shop.js    Filter / sort engine
  js/product.js Product detail page wiring
```

## Running it

Opening `index.html` directly works for browsing, but the cart drawer needs an
origin, so run a server:

```powershell
# browsable without payments
python -m http.server 8000

# or the full app including the payments API
node server/index.js      # http://localhost:3000
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

## Payments (Razorpay)

The checkout button runs a real Razorpay Checkout flow. **The secret key never
reaches the browser** — order creation, signature verification and webhooks all
happen in `server/`.

```
Browser  ──POST /api/orders (ids only)──▶  server  ──Razorpay /v1/orders──▶  Razorpay
        ◀──order_id + public key_id──────┘
        ──Razorpay Checkout UI (card / UPI / netbanking)──▶
        ──POST /api/verify (signature)──▶  server verifies + confirms capture
```

### Setup

1. Get your keys from **Razorpay Dashboard → Account & Settings → Developer
   Controls → API Keys → Generate Key**. Start in **Test mode** — it is
   available as soon as you sign up, needs no KYC, and is a sandbox where no
   real money moves. (Live mode additionally needs an OTP to generate keys, and
   account activation/KYC before you can accept real payments.)

   ⚠️ The **key secret is displayed only once**, at generation time — it is
   never visible on the dashboard again. Take Razorpay's download at that
   moment, or regenerate the pair if you lose it.

2. Fill in the two values in `.env` — either open it in any editor, or let the
   helper do it behind a masked prompt so the secret is never echoed to the
   screen or typed into a command line:

   ```powershell
   node setup-keys.js
   ```

   **Never paste the secret into a chat, issue or screenshot, and never commit
   `.env`** — it is git-ignored. `server/index.js` loads `.env` itself, so no
   dotenv dependency and no extra flags.

3. Verify the keys without printing the secret:
   ```powershell
   node key-check.js
   #   key id    rzp_test_…1a2b  (TEST mode)
   #   secret    ************  (20 chars, not shown)
   #   PASS      Credentials are valid.
   ```

4. Start the server and confirm it picked them up:
   ```powershell
   node server/index.js
   # [vedara] payments: configured
   # [vedara] key source: .env
   # [vedara] key id: rzp_test… (test mode)
   ```

5. Open `http://localhost:3000`, add something to the basket and check out.
   Razorpay's modal opens with a **Test Mode** ribbon. Useful test cards:

   | Card / UPI | Result |
   | --- | --- |
   | `4111 1111 1111 1111` | success — any future expiry, any CVV |
   | `4000 0000 0000 0002` | failure |
   | UPI `success@ybl` | success |
   | UPI `failure@ybl` | failure |

6. Optional but recommended — add a webhook in the dashboard pointing at
   `https://your-api-host/api/webhook`, subscribe to `payment.captured`, and put
   the signing secret in `RAZORPAY_WEBHOOK_SECRET`. Fulfil from the webhook, not
   from the browser: a customer can close the tab before `/api/verify` returns.

### Why there is a server at all

GitHub Pages serves static files only. Razorpay order creation requires your
**secret** key, so the front end cannot do it — hence `server/`. The static
site stays on Pages; only the API needs a host.

| Host | Notes |
| --- | --- |
| [Render](https://render.com) | free web service, simplest, `npm start` equivalent |
| [Railway](https://railway.app) | free tier, good DX |
| [Fly.io](https://fly.io) | free allowance, runs worldwide (Razorpay is India-first) |
| A VM | `node server/index.js` behind nginx |

Start command is `node server/index.js`. Then point the front end at the API by
setting `data-api-base` on the `<html>` tag:

```html
<html lang="en" data-api-base="https://vedara-api.onrender.com">
```

and lock it down with `ALLOWED_ORIGINS=https://amplaytro.github.io` on the
server. With no `data-api-base` the front end calls its own origin, which is
what you want when the Node server also serves the files.

### Security properties

- **Prices are never trusted from the client.** The browser sends only
  `{id, variant, qty}`; `server/catalog.js` re-prices against the same
  `data.js` the UI loads, so a tampered cart cannot change the amount charged.
- Payments are verified by HMAC-SHA256 signature *and* by asking Razorpay
  whether the payment was actually captured, before the cart is cleared.
- Signatures are compared with `crypto.timingSafeEqual`.
- Cart size, per-line quantity and total are bounds-checked server-side.
- The API never serves `server/`, `.env`, dotfiles or `node_modules`, even
  though they sit inside the static root.
- The Pages workflow stages the site and excludes server-side source, so the
  deployed site never publishes backend code.

### Go-live checklist

- [ ] Swap test keys for live keys
- [ ] Set `ALLOWED_ORIGINS` to your real domain (not `*`)
- [ ] Register the `/api/webhook` endpoint and fulfil from it
- [ ] Add order emails / fulfilment on `payment.captured`
- [ ] Reconcile `payment.failed` and autorelease the Razorpay order
- [ ] Replace the placeholder product copy, prices and reviews

## Using a different payment provider

`assets/js/checkout.js` owns the `[data-checkout]` button and is the only file
you need to replace. `cart.js` keeps a fallback that just toasts a message, so
if you delete `checkout.js` the button degrades politely instead of doing
nothing. The `/api/orders` + `/api/verify` shape maps cleanly onto Stripe
PaymentIntents or Shopify's Storefront API.

## Tests

Headless checks, run with Node (no packages to install):

```powershell
node cart-test.js        # 42 — cart maths, size pricing, persistence
node filter-test.js      # 36 — facets, price bands, sorting
node quote-test.js       # 11 — server-side pricing and cart validation
node globals-test.js     # 11 — duplicate top-level declarations across scripts
node overflow-probe.js   # 20 — horizontal overflow at 360–1440px
node payment-visual.js   # 10 — Razorpay wiring in a real browser
node cart-visual.js      # 25 — cart drawer end to end
```

`globals-test.js` earns its keep: every file is a classic `<script>`, so they
share one global scope. A duplicate top-level `const` is a SyntaxError that
silently deletes a whole feature — that is exactly how `checkout.js` first
disappeared because it redeclared `money`.

`overflow-probe.js`, `shoot.js`, `payment-visual.js` and `cart-visual.js` drive
Chrome over the DevTools protocol and need Chrome installed.

## Notes

- Fully responsive; verified free of horizontal overflow at 360–1440px.
- Respects `prefers-reduced-motion`.
- Keyboard accessible: visible focus rings, focus trap in the cart drawer,
  `aria-expanded` on accordions, `aria-live` on toasts, focus returned on close.
- No runtime dependencies and no build step — plain files, open and run.
- Product copy, prices, reviews and the clinical claims are illustrative
  placeholder content — replace before going live.