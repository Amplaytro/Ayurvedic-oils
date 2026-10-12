/* ==========================================================================
   VEDARA — Home page
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* Featured: pick one bestseller per category, capped at four. */
  const host = document.querySelector("[data-featured]");
  if (!host) return;

  const featured = CATEGORIES.map((c) =>
    PRODUCTS.filter((p) => p.category === c.id).sort((a, b) => b.rating - a.rating)[0]
  ).filter(Boolean);

  host.innerHTML = featured.map((p, i) => productCard(p)).join("");

  // Newly injected cards need the reveal observer.
  initReveal();
});