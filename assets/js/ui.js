/* ==========================================================================
   VEDARA — Shared UI
   Header state, mobile nav, scroll reveal, accordions, product card
   renderer, ingredient renderer, FAQ renderer.
   ========================================================================== */

/* --- artwork helper ----------------------------------------------------- */
/** Maps a product's `art` key to the SVG asset path. */
function artSrc(product) {
  if (!product) return "";
  if (product.image) return product.image;
  const ing = INGREDIENTS[product.art];
  return ing ? ing.image : "";
}

const starStr = (rating) => "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

/* --- Header ------------------------------------------------------------- */
function initHeader() {
  const header = document.querySelector(".header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initCurrentPage() {
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const target = link.getAttribute("href").toLowerCase();
    const isMatch =
      target === here ||
      (here === "" && target === "index.html") ||
      (here === "index.html" && target === "index.html");
    if (isMatch) link.setAttribute("aria-current", "page");
  });
}

/* --- Mobile nav --------------------------------------------------------- */
function openMobileNav() {
  const nav = document.querySelector(".mobile-nav");
  const burger = document.querySelector(".burger");
  if (!nav) return;
  nav.classList.add("is-open");
  burger && burger.classList.add("is-open");
  burger && burger.setAttribute("aria-expanded", "true");
  document.body.classList.add("is-locked");
}

function closeMobileNav() {
  const nav = document.querySelector(".mobile-nav");
  const burger = document.querySelector(".burger");
  if (!nav) return;
  nav.classList.remove("is-open");
  burger && burger.classList.remove("is-open");
  burger && burger.setAttribute("aria-expanded", "false");
  document.body.classList.remove("is-locked");
}

function initMobileNav() {
  const burger = document.querySelector(".burger");
  const nav = document.querySelector(".mobile-nav");
  if (!burger || !nav) return;

  burger.addEventListener("click", () =>
    nav.classList.contains("is-open") ? closeMobileNav() : openMobileNav()
  );
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMobileNav();
  });
}

/* --- Scroll reveal ------------------------------------------------------ */
function initReveal() {
  const items = document.querySelectorAll("[data-reveal]");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.revealDelay || 0);
        setTimeout(() => entry.target.classList.add("is-in"), delay);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  items.forEach((el) => io.observe(el));
}

/* --- Accordions --------------------------------------------------------- */
function initAccordions(root = document) {
  root.querySelectorAll(".acc__btn").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      const open = btn.getAttribute("aria-expanded") === "true";

      // Close siblings in the same accordion group
      const group = btn.closest(".acc");
      if (group && !open) {
        group.querySelectorAll('.acc__btn[aria-expanded="true"]').forEach((other) => {
          if (other === btn) return;
          other.setAttribute("aria-expanded", "false");
          const p = document.getElementById(other.getAttribute("aria-controls"));
          p && p.classList.remove("is-open");
        });
      }

      btn.setAttribute("aria-expanded", String(!open));
      panel && panel.classList.toggle("is-open", !open);
    });
  });
}

/** Builds an accordion from an array of {q, a} (a may contain trusted HTML). */
function renderAccordion(host, items, opts = {}) {
  if (!host) return "";
  const base = opts.idPrefix || "acc";
  host.classList.add("acc");
  host.innerHTML = items
    .map((item, i) => {
      const id = `${base}-${i}`;
      return `
        <div class="acc__item">
          <h3 style="font-family:var(--sans);font-weight:400;margin:0">
            <button class="acc__btn" type="button" aria-expanded="false" aria-controls="${id}">
              <span>${item.q}</span>
              <span class="acc__ico" aria-hidden="true"></span>
            </button>
          </h3>
          <div class="acc__panel" id="${id}" role="region">
            <div class="acc__inner"><div>${item.a}</div></div>
          </div>
        </div>`;
    })
    .join("");
  initAccordions(host.parentElement || host);
  return host;
}

/* --- Product card renderer --------------------------------------------- */
/**
 * @param {object} p        product
 * @param {object} [opts]   { variant, showDesc }
 */
function productCard(p, opts = {}) {
  const variant = opts.variant || "100ml";
  const tag = p.tag
    ? `<span class="card__tag ${p.tagStyle ? "card__tag--" + p.tagStyle : ""}">${p.tag}</span>`
    : "";

  return `
    <article class="card" data-reveal>
      <div class="card__media">
        ${tag}
        <button class="card__fav" type="button" data-fav aria-label="Save ${p.name} to wishlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></svg>
        </button>
        <img src="${artSrc(p)}" alt="${INGREDIENTS[p.art].name} botanical — ${p.name}" loading="lazy" width="200" height="240">
      </div>
      <div class="card__body">
        <span class="card__cat">${CATEGORIES.find((c) => c.id === p.category)?.label || ""}</span>
        <h3 class="card__name"><a href="product.html?id=${p.id}">${p.name}</a></h3>
        <p class="card__desc">${p.short}</p>
        <div class="card__foot">
          <div>
            <div class="card__price">${money(p.price)}${
              p.was ? `<span class="was">${money(p.was)}</span>` : ""
            }</div>
            <div class="card__stars">${starStr(p.rating)} <span>${p.rating} · ${p.reviews}</span></div>
          </div>
          <button class="card__add" type="button" data-add="${p.id}"
                  aria-label="Add ${p.name} to basket">Add</button>
        </div>
      </div>
    </article>`;
}

/* --- Ingredient card renderer ------------------------------------------ */
function ingredientCard(key, opts = {}) {
  const ing = INGREDIENTS[key];
  if (!ing) return "";
  const idx = opts.index;
  const delay = idx != null && idx % 4 !== 0 ? (idx % 4) * 90 : 0;
  return `
    <article class="ing" data-reveal data-reveal-delay="${delay}">
      <div class="ing__art">
        <img src="${ing.image}" alt="${ing.name} — ${ing.latin}" loading="lazy" width="200" height="240">
      </div>
      <span class="ing__sanskrit">${ing.sanskrit}</span>
      <h3 class="ing__name">${ing.name}</h3>
      <p class="ing__latin">${ing.latin}</p>
      <p class="ing__body">${ing.desc}</p>
      <p class="ing__use">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4.4 8-10V5l-8-3-8 3v7c0 5.6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
        <span>${ing.use}</span>
      </p>
    </article>`;
}

/* --- FAQ renderer ------------------------------------------------------- */
function renderFAQs(host) {
  if (!host) return;
  // data-faq="short" shows only the first two categories.
  const groups =
    host.dataset.faq === "short" ? FAQS.slice(0, 2) : FAQS;

  let n = 0;
  host.innerHTML = groups.map(
    (group) => `
      <p class="faq-cat">${group.cat}</p>
      <div class="acc" data-group="${group.cat}">
        ${group.items
          .map((item) => {
            const id = `faq-${n++}`;
            return `
            <div class="acc__item">
              <h3 style="font-family:var(--sans);font-weight:400;margin:0">
                <button class="acc__btn" type="button" aria-expanded="${n === 1 ? "true" : "false"}" aria-controls="${id}">
                  <span>${item.q}</span>
                  <span class="acc__ico" aria-hidden="true"></span>
                </button>
              </h3>
              <div class="acc__panel ${n === 1 ? "is-open" : ""}" id="${id}" role="region">
                <div class="acc__inner"><div>${item.a}</div></div>
              </div>
            </div>`;
          })
          .join("")}
      </div>`
  ).join("");
  initAccordions(host);
}

/* --- Newsletter --------------------------------------------------------- */
function initSubscribe() {
  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form.matches("[data-subscribe]")) return;
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const note = form.parentElement.querySelector(".form-note") || form.querySelector(".form-note");
    const value = (input?.value || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      if (note) note.textContent = "Please enter a valid email address.";
      input?.focus();
      return;
    }
    if (note) note.textContent = "Welcome. Your 15% code is on its way.";
    form.reset();
    if (typeof toast === "function") toast("Check your inbox for your welcome code");
  });
}

/* --- Wishlist (local only) --------------------------------------------- */
const FAV_KEY = "vedara.favourites.v1";
function initFavourites() {
  let favs = [];
  try {
    favs = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    favs = [];
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fav]");
    if (!btn) return;
    const id = btn.closest("[data-product-id]")?.dataset.productId ||
               btn.closest(".card")?.querySelector("[data-add]")?.dataset.add;
    if (!id) return;
    btn.classList.toggle("is-on");
    const on = btn.classList.contains("is-on");
    favs = on ? [...new Set([...favs, id])] : favs.filter((f) => f !== id);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    } catch {}
    if (typeof toast === "function") toast(on ? "Saved to your wishlist" : "Removed from wishlist");
  });
}

/* --- Footer year -------------------------------------------------------- */
function initYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

/* --- Boot --------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initCurrentPage();
  initMobileNav();
  initAccordions();
  initSubscribe();
  initFavourites();
  initYear();
  initReveal();

  // Build the FAQ list wherever a [data-faq] host is present
  document.querySelectorAll("[data-faq]").forEach(renderFAQs);

  // Build ingredient grids wherever a [data-ingredients] host is present
  document.querySelectorAll("[data-ingredients]").forEach((host) => {
    const keys = (host.dataset.ingredients || "").split(",").map((s) => s.trim()).filter(Boolean);
    host.innerHTML = keys.map((k, i) => ingredientCard(k, { index: i })).join("");
  });

  // Any element that mutates after boot still needs reveal + accordion wiring
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (!el.classList.contains("is-in")) return;
    void el.offsetWidth;
  });
  initReveal();
});