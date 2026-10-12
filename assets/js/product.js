/* ==========================================================================
   VEDARA — Product detail page
   Renders the whole page from ?id=<productId>
   ========================================================================== */

const ICON = {
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4.4 8-10V5l-8-3-8 3v7c0 5.6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
};

document.addEventListener("DOMContentLoaded", () => {
  const host = document.getElementById("pdp");
  const id = new URLSearchParams(location.search).get("id");
  const product = PRODUCTS.find((p) => p.id === id);

  /* --- Unknown / missing id --------------------------------------------- */
  if (!product) {
    if (host) {
      host.innerHTML = `
        <div class="empty">
          <h3>We couldn't find that oil.</h3>
          <p>It may have been renamed or retired. The full collection is one click away.</p>
          <a class="btn btn--sm" href="shop.html">Browse all eight oils</a>
        </div>`;
    }
    return;
  }

  /* --- Head / meta ------------------------------------------------------ */
  document.title = `${product.name} — Vedara`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", product.short);

  const catLabel = CATEGORIES.find((c) => c.id === product.category)?.label || "";
  const ing = INGREDIENTS[product.art];
  const chosen = defaultSize(product);

  /* --- Breadcrumbs ------------------------------------------------------ */
  const crumbs = document.getElementById("crumbs");
  if (crumbs) {
    crumbs.innerHTML = `
      <a href="index.html">Home</a><span>/</span>
      <a href="shop.html">Browse</a><span>/</span>
      <a href="shop.html?cat=${product.category}">${catLabel}</a><span>/</span>
      <span class="cur">${product.name}</span>`;
  }

  /* --- Main PDP --------------------------------------------------------- */
  if (host) {
    host.innerHTML = `
      <div class="pdp">
        <div class="pdp__media">
          <img src="${artSrc(product)}" alt="${ing.name} — ${product.name}"
               width="200" height="240" style="width:100%;height:100%;object-fit:contain">
        </div>

        <div class="pdp__copy" data-product-scope data-product-id="${product.id}">
          <span class="eyebrow">${catLabel}</span>
          <h1 class="pdp__title">${product.name}</h1>
          <p class="muted" style="letter-spacing:.1em;text-transform:uppercase;font-size:.72rem">${product.subtitle}</p>

          <div class="pdp__meta">
            <span style="color:var(--gold);letter-spacing:.16em">${starStr(product.rating)}</span>
            <span>${product.rating} · ${product.reviews} reviews</span>
            <span>·</span>
            <span>${product.volume}</span>
          </div>

          <div class="pdp__price">
            <span data-price>${money(variantPrice(product, chosen))}</span>
            ${product.was ? `<span class="was" data-was>${money(variantWas(product, chosen))}</span>` : ""}
            ${product.was ? `<span class="save" data-save>Save ${money(variantWas(product, chosen) - variantPrice(product, chosen))}</span>` : ""}
          </div>

          <p class="lede">${product.story}</p>

          <div class="opt-row">
            <span class="opt-label" id="sizeLabel">Size</span>
            <div class="opts" role="radiogroup" aria-labelledby="sizeLabel">
              ${SIZES.map(
                (s) => `
                <button class="opt ${s.id === chosen ? "is-on" : ""}" type="button" role="radio"
                        aria-checked="${s.id === chosen}" data-variant="${s.id}" data-mult="${s.mult}">
                  ${s.label} · ${s.ml}ml
                </button>`
              ).join("")}
            </div>
          </div>

          <div class="buy-row">
            <div class="qty">
              <button type="button" data-qty-dec aria-label="Decrease quantity">&minus;</button>
              <input type="number" value="1" min="1" max="99" aria-label="Quantity" data-qty-input>
              <button type="button" data-qty-inc aria-label="Increase quantity">+</button>
            </div>
            <button class="btn" type="button" data-add="${product.id}">Add to basket — <span data-btn-price>${money(variantPrice(product, chosen))}</span></button>
          </div>

          <ul class="pdp__notes">
            <li>${ICON.leaf}<span><b>Every ingredient listed in full</b> on the carton — nothing undisclosed, nothing you cannot pronounce.</span></li>
            <li>${ICON.truck}<span>Ships within one working day. Free over $60, otherwise $6 flat.</span></li>
            <li>${ICON.refresh}<span>30-day returns, opened or unopened. If it is not for you, send it back.</span></li>
            <li>${ICON.shield}<span>Vegan, cruelty free, non-comedogenic and batch tested.</span></li>
          </ul>

          <div>
            <div class="opt-label" style="margin-bottom:10px">Why you'll use it</div>
            <ul class="checks">
              ${product.benefits.map((b) => `<li>${ICON.check}<span>${b}</span></li>`).join("")}
            </ul>
          </div>
        </div>
      </div>

      <div class="pdp-extras">
        <div>
          <h2 style="font-size:clamp(1.6rem,2.6vw,2.1rem);color:var(--forest);margin-bottom:8px">How to use it</h2>
          <p class="muted" style="font-size:.9rem;margin-bottom:18px">The classical method. Consistency matters far more than quantity.</p>
          <div class="grid-steps" style="grid-template-columns:1fr 1fr;gap:20px">
            ${product.howTo.map((step, i) => `
              <div class="step">
                <h4>Step ${i + 1}</h4>
                <p>${step}</p>
              </div>`).join("")}
          </div>
        </div>
        <div>
          <h2 style="font-size:clamp(1.6rem,2.6vw,2.1rem);color:var(--forest);margin-bottom:18px">Details</h2>
          <div id="pdpAcc"></div>
        </div>
      </div>`;
  }

  /* --- Size selection --------------------------------------------------- */
  const optsHost = host?.querySelector(".opts");
  optsHost?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-variant]");
    if (!btn) return;
    optsHost.querySelectorAll("[data-variant]").forEach((b) => {
      b.classList.toggle("is-on", b === btn);
      b.setAttribute("aria-checked", String(b === btn));
    });
    updatePrice(Number(btn.dataset.mult));
  });

  function updatePrice(mult) {
    const variantId = optsHost.querySelector("[data-variant].is-on")?.dataset.variant || chosen;
    const price = variantPrice(product, variantId);
    const priceEl = host.querySelector("[data-price]");
    const btnPrice = host.querySelector("[data-btn-price]");
    const wasEl = host.querySelector("[data-was]");
    const saveEl = host.querySelector("[data-save]");

    if (priceEl) priceEl.textContent = money(price);
    if (btnPrice) btnPrice.textContent = money(price);

    if (wasEl) {
      const was = variantWas(product, variantId);
      wasEl.textContent = was ? money(was) : "";
      wasEl.style.display = was ? "" : "none";
    }
    if (saveEl) {
      const was = variantWas(product, variantId);
      saveEl.style.display = was ? "" : "none";
      if (was) saveEl.textContent = `Save ${money(was - variantPrice(product, variantId))}`;
    }
  }

  /* --- Quantity --------------------------------------------------------- */
  const qtyInput = host?.querySelector("[data-qty-input]");
  host?.querySelector("[data-qty-inc]")?.addEventListener("click", () => {
    qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
  });
  host?.querySelector("[data-qty-dec]")?.addEventListener("click", () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
  });
  qtyInput?.addEventListener("change", () => {
    qtyInput.value = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
  });

  /* --- Details accordion ------------------------------------------------ */
  const acc = document.getElementById("pdpAcc");
  if (acc) {
    renderAccordion(
      acc,
      [
        { q: "Full ingredient list", a: `<p>${product.fullIngredients}</p>` },
        { q: "How it is made", a: `<p>Botanicals are stone-ground and slow-steeped for twenty-one days in cold-pressed sesame or coconut oil. Nothing is heated above 40°C, and no solvent extraction is used at any stage. Each batch is filtered and tested for purity, then filled into amber glass to protect the actives from light.</p>` },
        { q: "Suitable for", a: `<ul><li>${product.skin === "all" ? "All skin and hair types" : `Best suited to ${SKIN_TYPES.find((s) => s.id === product.skin)?.label.toLowerCase()} skin`}</li><li>Vegan and cruelty free</li><li>Non-comedogenic — tested over four weeks on oily skin</li><li>Patch test on the inner forearm for 24 hours if pregnant, breastfeeding or managing a skin condition</li></ul>` },
        { q: "Shipping & returns", a: `<p>Dispatched within one working day. Standard delivery is 3–5 working days, and shipping is free on orders over $60. If it is not right for your hair or your skin, return it within 30 days — opened or not — for a full refund.</p>` }
      ],
      { idPrefix: "pdp" }
    );
  }

  /* --- Botanicals in this bottle --------------------------------------- */
  const bSection = document.getElementById("botanicalSection");
  const bGrid = document.getElementById("botanicalGrid");
  if (bSection && bGrid) {
    bSection.style.display = "";
    bGrid.innerHTML = product.keyIngredients
      .map((k, i) => ingredientCard(k, { index: i }))
      .join("");
  }

  /* --- Related ---------------------------------------------------------- */
  const rGrid = document.getElementById("relatedGrid");
  if (rGrid) {
    const sameCat = PRODUCTS.filter(
      (p) => p.category === product.category && p.id !== product.id
    );
    const pool = [...sameCat, ...PRODUCTS.filter((p) => p.id !== product.id && !sameCat.includes(p))];
    rGrid.innerHTML = pool
      .slice(0, 3)
      .map((p) => productCard(p))
      .join("");
  }

  initReveal();
});