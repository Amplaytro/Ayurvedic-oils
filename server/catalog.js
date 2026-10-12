/**
 * Server-side catalogue access.
 *
 * The single source of truth for products and prices is `assets/js/data.js`,
 * which the browser already loads. Rather than duplicate that file (and risk
 * the two drifting apart), we evaluate it here and read the values out.
 *
 * This matters for security: the client tells us *what* the customer is
 * buying, never *how much it costs*. Every price is recomputed from here.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DATA_FILE = path.join(__dirname, '..', 'assets', 'js', 'data.js');

function loadCatalogue() {
  const source = fs.readFileSync(DATA_FILE, 'utf8');
  const context = vm.createContext({ console });
  // The trailing expression makes the script *evaluate* to the values we want,
  // which is what runInContext returns as its completion value.
  return vm.runInContext(
    source + '\n;({ PRODUCTS, SIZES, CONFIG, variantPrice, defaultSize });',
    context,
    { filename: DATA_FILE }
  );
}

const { PRODUCTS, SIZES, CONFIG, variantPrice } = loadCatalogue();
const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

const MAX_QTY_PER_LINE = 10;
const MAX_LINES = 20;

/**
 * Validate a client-supplied basket and return a trusted, priced quote.
 *
 * @param {unknown} lines  [{ id, variant, qty }]
 * @returns {{ok: true, lines: Array, subtotal: number, shipping: number, total: number, itemCount: number}
 *          | {ok: false, error: string}}
 */
function quote(lines) {
  if (!Array.isArray(lines)) return { ok: false, error: 'lines must be an array' };
  if (lines.length === 0) return { ok: false, error: 'cart is empty' };
  if (lines.length > MAX_LINES) return { ok: false, error: 'too many distinct lines' };

  // Merge duplicate lines so one line cannot be used to dodge the qty cap.
  const merged = new Map();
  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'malformed line' };
    const { id, variant, qty } = raw;
    if (typeof id !== 'string' || typeof qty !== 'number' || !Number.isFinite(qty)) {
      return { ok: false, error: 'malformed line' };
    }
    const key = `${id}::${variant ?? 'standard'}`;
    const total = (merged.get(key) || 0) + Math.floor(qty);
    if (total > MAX_QTY_PER_LINE) return { ok: false, error: 'quantity exceeds the per-order limit' };
    merged.set(key, total);
  }

  const priced = [];
  for (const [key, qty] of merged) {
    const [id, variant] = key.split('::');
    const product = BY_ID.get(id);
    if (!product) return { ok: false, error: `unknown product: ${id}` };

    const size = SIZES.find((s) => s.id === variant);
    if (!size) return { ok: false, error: `unknown size for ${id}` };
    if (qty < 1) return { ok: false, error: 'quantity must be at least 1' };

    const unit = variantPrice(product, variant);
    priced.push({
      id: product.id,
      name: product.name,
      variant,
      variantLabel: `${size.label} · ${size.ml}ml`,
      qty,
      unit,
      lineTotal: unit * qty
    });
  }

  const subtotal = priced.reduce((sum, l) => sum + l.lineTotal, 0);
  const shipping = subtotal >= CONFIG.freeShippingAt || subtotal === 0 ? 0 : CONFIG.flatRate;

  return {
    ok: true,
    lines: priced,
    subtotal,
    shipping,
    total: subtotal + shipping,
    itemCount: priced.reduce((sum, l) => sum + l.qty, 0)
  };
}

module.exports = { quote, PRODUCTS, SIZES, CONFIG, variantPrice };