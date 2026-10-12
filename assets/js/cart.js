/* ==========================================================================
   VEDARA — Cart engine
   Persists to localStorage, renders the slide-in drawer, keeps every
   badge/button on the page in sync via the 'cart:change' event.
   ========================================================================== */

const CART_KEY = "vedara.cart.v1";

/* --- helpers ------------------------------------------------------------ */
const money = (n) =>
  CONFIG.symbol + n.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  });

const findProduct = (id) => PRODUCTS.find((p) => p.id === id);

/* --- state -------------------------------------------------------------- */
/** @type {Array<{id:string, variant:string, qty:number}>} */
let cartItems = [];

function loadCart() {
  let parsed = [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    // Anything we cannot read as an array means "no usable cart".
    if (!raw) parsed = [];
    else {
      const value = JSON.parse(raw);
      parsed = Array.isArray(value) ? value : [];
    }
  } catch {
    parsed = [];
  }

  // Drop anything that no longer exists in the catalog.
  cartItems = parsed
    .filter((it) => it && findProduct(it.id) && typeof it.qty === "number")
    .map((it) => {
      const variant = typeof it.variant === "string" ? it.variant : "standard";
      return {
        id: it.id,
        variant,
        qty: Math.max(1, Math.min(99, Math.floor(it.qty))),
        unit: typeof it.unit === "number" ? it.unit : variantPrice(findProduct(it.id), variant)
      };
    });
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
  } catch {
    /* private mode / quota — cart stays in-memory */
  }
}

/* --- derived ------------------------------------------------------------ */
const count = () => cartItems.reduce((s, it) => s + it.qty, 0);

function detailed() {
  return cartItems
    .map((it) => {
      const product = findProduct(it.id);
      if (!product) return null;
      // Prefer the price captured when the item was added (size-specific),
      // falling back to the current catalogue price.
      const unit = typeof it.unit === "number" ? it.unit : product.price;
      return { ...it, product, unit, lineTotal: unit * it.qty };
    })
    .filter(Boolean);
}

const subtotal = () => detailed().reduce((s, it) => s + it.lineTotal, 0);

function shippingFor(sub) {
  if (sub === 0) return 0;
  return sub >= CONFIG.freeShippingAt ? 0 : CONFIG.flatRate;
}

const total = () => subtotal() + shippingFor(subtotal());

/* --- mutations ---------------------------------------------------------- */
function addToCart(id, variant = "standard", qty = 1, unit = null) {
  const product = findProduct(id);
  if (!product) return null;

  const price = typeof unit === "number" ? unit : variantPrice(product, variant);
  const existing = cartItems.find((it) => it.id === id && it.variant === variant);
  if (existing) {
    existing.qty = Math.min(99, existing.qty + qty);
    existing.unit = price;
  } else {
    cartItems.push({ id, variant, qty: Math.max(1, qty), unit: price });
  }
  commit();
  return { product, qty };
}

function setQty(id, variant, qty) {
  const it = cartItems.find((x) => x.id === id && x.variant === variant);
  if (!it) return;
  if (qty <= 0) return removeFromCart(id, variant);
  it.qty = Math.min(99, qty);
  commit();
}

function removeFromCart(id, variant) {
  cartItems = cartItems.filter((it) => !(it.id === id && it.variant === variant));
  commit();
}

function clearCart() {
  cartItems = [];
  commit();
}

function commit() {
  saveCart();
  renderDrawer();
  updateBadges();
  document.dispatchEvent(new CustomEvent("cart:change", { detail: { count: count() } }));
}

/* --- rendering ---------------------------------------------------------- */
const drawerEl = () => document.getElementById("cartDrawer");
const scrimEl = () => document.getElementById("scrim");

const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const ICON_LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

const ICON_BAG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';

function renderDrawer() {
  const drawer = drawerEl();
  if (!drawer) return;

  const items = detailed();
  const sub = subtotal();
  const ship = shippingFor(sub);
  const remaining = CONFIG.freeShippingAt - sub;

  /* Shipping progress */
  const shipWrap = drawer.querySelector("[data-cart-ship]");
  if (shipWrap) {
    if (sub === 0) {
      shipWrap.innerHTML = "";
    } else {
      const pct = Math.min(100, (sub / CONFIG.freeShippingAt) * 100);
      shipWrap.innerHTML = `
        <p>${
          remaining > 0
            ? `You're <b>${money(remaining)}</b> away from free shipping.`
            : `<b>Free shipping unlocked.</b> Thank you.`
        }</p>
        <div class="ship-bar"><i style="width:${pct}%"></i></div>`;
    }
  }

  /* Lines */
  const body = drawer.querySelector("[data-cart-body]");
  if (!body) return;

  if (!items.length) {
    body.innerHTML = `
      <div class="drawer__empty">
        ${ICON_BAG}
        <h3 style="font-size:1.6rem;color:var(--forest)">Your basket is empty</h3>
        <p>Every oil is cold-pressed and slow-steeped. Begin with a single bottle and a nightly ritual.</p>
        <a class="btn btn--sm" href="shop.html" data-close-cart>Browse the oils</a>
      </div>`;
    const foot = drawer.querySelector("[data-cart-foot]");
    if (foot) foot.hidden = true;
    return;
  }

  const foot = drawer.querySelector("[data-cart-foot]");
  if (foot) foot.hidden = false;

  body.innerHTML = items
    .map(
      (it) => `
      <article class="line-item">
        <a class="line-item__media" href="product.html?id=${it.id}" data-close-cart>
          <img src="${artSrc(it.product)}" alt="${it.product.name}" loading="lazy">
        </a>
        <div class="line-item__body">
          <a class="line-item__name" href="product.html?id=${it.id}" data-close-cart>${it.product.name}</a>
          <span class="line-item__var">${VARIANT_LABEL[it.variant] || it.variant} · ${money(it.unit)}</span>
          <div class="line-item__foot">
            <div class="mini-qty">
              <button type="button" data-dec="${it.id}" data-var="${it.variant}" aria-label="Decrease quantity">&minus;</button>
              <span>${it.qty}</span>
              <button type="button" data-inc="${it.id}" data-var="${it.variant}" aria-label="Increase quantity">+</button>
            </div>
            <span class="line-item__price">${money(it.lineTotal)}</span>
          </div>
          <button class="line-item__remove" type="button" data-del="${it.id}" data-var="${it.variant}">Remove</button>
        </div>
      </article>`
    )
    .join("");

  /* Totals */
  const totalsEl = drawer.querySelector("[data-cart-totals]");
  if (totalsEl) {
    totalsEl.innerHTML = `
      <div><span>Subtotal</span><span>${money(sub)}</span></div>
      <div>
        <span>Shipping</span>
        <span class="${ship === 0 ? "free" : ""}">${ship === 0 ? "Free" : money(ship)}</span>
      </div>
      <div class="grand"><span>Total</span><span>${money(sub + ship)}</span></div>`;
  }
}

/* Delegated interactions inside the drawer */
document.addEventListener("click", (e) => {
  const t = e.target;

  const inc = t.closest("[data-inc]");
  if (inc) {
    const it = cartItems.find((x) => x.id === inc.dataset.inc && x.variant === inc.dataset.var);
    if (it) setQty(it.id, it.variant, it.qty + 1);
    return;
  }
  const dec = t.closest("[data-dec]");
  if (dec) {
    const it = cartItems.find((x) => x.id === dec.dataset.dec && x.variant === dec.dataset.var);
    if (it) setQty(it.id, it.variant, it.qty - 1);
    return;
  }
  const del = t.closest("[data-del]");
  if (del) {
    removeFromCart(del.dataset.del, del.dataset.var);
    toast("Removed from basket");
    return;
  }
  if (t.closest("[data-close-cart]")) closeCart();
});

/* --- badges ------------------------------------------------------------- */
function updateBadges() {
  const n = count();
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = n;
    el.classList.toggle("is-visible", n > 0);
    el.setAttribute("aria-label", `${n} item${n === 1 ? "" : "s"} in basket`);
  });
}

/* --- open / close ------------------------------------------------------- */
let lastFocus = null;

function openCart() {
  const drawer = drawerEl();
  const scrim = scrimEl();
  if (!drawer) return;
  lastFocus = document.activeElement;
  drawer.classList.add("is-open");
  scrim && scrim.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-locked");
  document.querySelectorAll("[data-cart-toggle]").forEach((b) =>
    b.setAttribute("aria-expanded", "true")
  );
  const close = drawer.querySelector("[data-cart-close]");
  close && setTimeout(() => close.focus(), 60);
}

function closeCart() {
  const drawer = drawerEl();
  const scrim = scrimEl();
  if (!drawer) return;
  drawer.classList.remove("is-open");
  scrim && scrim.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-locked");
  document.querySelectorAll("[data-cart-toggle]").forEach((b) =>
    b.setAttribute("aria-expanded", "false")
  );
  lastFocus && lastFocus.focus && lastFocus.focus();
}

const toggleCart = () =>
  drawerEl() && drawerEl().classList.contains("is-open") ? closeCart() : openCart();

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const drawer = drawerEl();
  const filters = document.querySelector("[data-filters]");
  if (drawer && drawer.classList.contains("is-open")) return closeCart();
  if (filters && filters.classList.contains("is-open")) {
    filters.classList.remove("is-open");
    scrimEl() && scrimEl().classList.remove("is-open");
    document.body.classList.remove("is-locked");
  }
  const mob = document.querySelector(".mobile-nav.is-open");
  if (mob) closeMobileNav();
});

/* --- toasts ------------------------------------------------------------- */
function toast(message, opts = {}) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${opts.icon || ICON_CHECK}<span>${message}</span>`;
  stack.appendChild(el);

  const life = opts.duration || 2600;
  setTimeout(() => {
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 360);
  }, life);
}

/* --- add-to-cart buttons anywhere on the page -------------------------- */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  e.preventDefault();

  const id = btn.dataset.add;
  const product = findProduct(id);
  if (!product) return;

  const scope = btn.closest("[data-product-scope]") || document;
  const qtyInput = scope.querySelector("[data-qty-input]");

  // Variants may be <input data-variant> radios or <button data-variant> toggles.
  const variantInput =
    scope.querySelector("[data-variant]:checked") ||
    scope.querySelector(".opts [data-variant].is-on") ||
    scope.querySelector("[data-variant]");

  const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
  const variant =
    variantInput?.value ||
    variantInput?.dataset.variant ||
    "standard";

  // Keep the displayed size price consistent between page and basket.
  const scopeBtn = scope.querySelector("[data-btn-price]");
  const unitPrice = scopeBtn
    ? parseInt(String(scopeBtn.textContent).replace(/[^0-9]/g, ""), 10) || null
    : null;

  addToCart(id, variant, qty, unitPrice);

  const label = btn.textContent;
  btn.classList.add("is-done");
  btn.textContent = "Added";
  toast(`${product.name} — added to basket`);
  bumpBadge();
  setTimeout(() => {
    btn.classList.remove("is-done");
    btn.textContent = label;
  }, 1400);
});

function bumpBadge() {
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.classList.remove("is-bump");
    void el.offsetWidth;
    el.classList.add("is-bump");
  });
}

/* --- init --------------------------------------------------------------- */
loadCart();

document.addEventListener("DOMContentLoaded", () => {
  // Cart open/close
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cart-toggle]")) toggleCart();
    if (e.target.closest("[data-cart-close]")) closeCart();
  });
  const scrim = scrimEl();
  if (scrim) scrim.addEventListener("click", closeCart);

  // Focus trap inside the drawer
  const drawer = drawerEl();
  if (drawer) {
    drawer.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusables = drawer.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  renderDrawer();
  updateBadges();
});

/* --- Checkout ----------------------------------------------------------- */
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-checkout]")) return;
  if (!count()) {
    toast("Your basket is empty");
    return;
  }
  // Wire this to your payment provider (Stripe Checkout, Shopify, etc.).
  toast(`Demo store — ${count()} item${count() === 1 ? "" : "s"}, ${money(total())}`);
});