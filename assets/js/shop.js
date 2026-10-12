/* ==========================================================================
   VEDARA — Shop page
   Faceted filtering + sorting, reflected in the URL query string.
   ========================================================================== */

const PRICE_BANDS = [
  { id: "under35", label: "Under $35", test: (p) => p.price < 35 },
  { id: "35to45",  label: "$35 – $45",  test: (p) => p.price >= 35 && p.price <= 45 },
  { id: "over45",  label: "$45 and up", test: (p) => p.price > 45 }
];

const state = {
  category: new Set(),
  concern: new Set(),
  skin: new Set(),
  price: new Set(),
  sort: "featured"
};

const $ = (s) => document.querySelector(s);

/* --- Build the filter UI ------------------------------------------------- */
function buildFilters() {
  const make = (host, items, group) => {
    if (!host) return;
    host.innerHTML = items
      .map(
        (it) => `
        <input type="checkbox" id="f-${group}-${it.id}" value="${it.id}" data-group="${group}">
        <label for="f-${group}-${it.id}">${it.label}</label>`
      )
      .join("");
  };

  make($("#fCategory"), CATEGORIES, "category");
  make($("#fConcern"), CONCERNS, "concern");
  make($("#fSkin"), SKIN_TYPES, "skin");
  make($("#fPrice"), PRICE_BANDS.map(({ id, label }) => ({ id, label })), "price");
}

/* --- URL sync ------------------------------------------------------------ */
function readURL() {
  const q = new URLSearchParams(location.search);

  const hydrate = (key, group) => {
    const raw = q.get(key);
    if (!raw) return;
    raw.split(",").forEach((v) => state[group].add(v));
  };

  hydrate("cat", "category");
  hydrate("concern", "concern");
  hydrate("skin", "skin");
  hydrate("price", "price");

  const sort = q.get("sort");
  if (sort && $("#sortBy").value !== sort) {
    const opt = [...$("#sortBy").options].find((o) => o.value === sort);
    if (opt) {
      $("#sortBy").value = sort;
      state.sort = sort;
    }
  }
}

let writeTimer = null;
function writeURL() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const q = new URLSearchParams();
    if (state.category.size) q.set("cat", [...state.category].join(","));
    if (state.concern.size) q.set("concern", [...state.concern].join(","));
    if (state.skin.size) q.set("skin", [...state.skin].join(","));
    if (state.price.size) q.set("price", [...state.price].join(","));
    if (state.sort !== "featured") q.set("sort", state.sort);
    const qs = q.toString();
    history.replaceState(null, "", qs ? `shop.html?${qs}` : "shop.html");
  }, 200);
}

/* --- Sync checkboxes from state ----------------------------------------- */
function syncInputs() {
  document.querySelectorAll("[data-group]").forEach((input) => {
    input.checked = state[input.dataset.group].has(input.value);
  });
}

/* --- Filtering + sorting ------------------------------------------------- */
function matches(p) {
  if (state.category.size && !state.category.has(p.category)) return false;

  if (state.concern.size) {
    const any = state.concern.values();
    let hit = false;
    for (const c of any) if (p.concerns.includes(c)) { hit = true; break; }
    if (!hit) return false;
  }

  if (state.skin.size) {
    // "All skin types" is a no-op modifier, not a value — if it is the only
    // thing selected the facet is inactive, otherwise it is ignored.
    const wanted = [...state.skin].filter((s) => s !== "all");
    if (wanted.length && !wanted.includes(p.skin)) return false;
  }

  if (state.price.size) {
    const hit = [...state.price].some((id) => PRICE_BANDS.find((b) => b.id === id).test(p));
    if (!hit) return false;
  }
  return true;
}

function sorted(list) {
  const s = [...list];
  switch (state.sort) {
    case "price-asc":  return s.sort((a, b) => a.price - b.price);
    case "price-desc": return s.sort((a, b) => b.price - a.price);
    case "name":       return s.sort((a, b) => a.name.localeCompare(b.name));
    case "rating":     return s.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    default:           return s.sort((a, b) => b.rating * b.reviews - a.rating * a.reviews);
  }
}

/* --- Active filter chips ------------------------------------------------- */
const LABELS = {
  category: (id) => CATEGORIES.find((c) => c.id === id)?.label || id,
  concern:  (id) => CONCERNS.find((c) => c.id === id)?.label || id,
  skin:     (id) => SKIN_TYPES.find((c) => c.id === id)?.label || id,
  price:    (id) => PRICE_BANDS.find((b) => b.id === id)?.label || id
};

function renderChips() {
  const host = $("#activeChips");
  if (!host) return;
  const chips = [];
  ["category", "concern", "skin", "price"].forEach((g) => {
    state[g].forEach((id) =>
      chips.push(
        `<button class="chip" type="button" data-clear-group="${g}" data-clear-val="${id}">${LABELS[g](id)} <b>&times;</b></button>`
      )
    );
  });
  host.innerHTML = chips.length
    ? chips.join("") + `<button class="chip" type="button" data-clear-group="all" data-clear-val=""><b>Clear all</b></button>`
    : "";
}

function activeCount() {
  return state.category.size + state.concern.size + state.skin.size + state.price.size;
}

/* --- Render -------------------------------------------------------------- */
function render() {
  const results = sorted(PRODUCTS.filter(matches));
  const host = $("#results");
  const count = $("#resultCount");
  const fab = $("#fabCount");

  if (fab) fab.textContent = activeCount() ? `(${activeCount()})` : "";

  if (count) {
    count.innerHTML = results.length
      ? `Showing <b>${results.length}</b> of ${PRODUCTS.length} oils`
      : "";
  }

  if (!results.length) {
    host.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h3>Nothing matches that combination.</h3>
        <p>Try removing a filter — or start from the most popular blend in the collection.</p>
        <button class="btn btn--sm btn--ghost" type="button" data-clear-group="all" data-clear-val="">Clear all filters</button>
      </div>`;
  } else {
    host.innerHTML = results.map((p) => productCard(p)).join("");
  }

  renderChips();
  syncInputs();
  initReveal();
}

/* --- Wiring -------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  buildFilters();
  readURL();
  render();

  // Filter changes
  document.addEventListener("change", (e) => {
    const input = e.target.closest("[data-group]");
    if (input) {
      const set = state[input.dataset.group];
      input.checked ? set.add(input.value) : set.delete(input.value);
      render();
      writeURL();
      return;
    }
    if (e.target.id === "sortBy") {
      state.sort = e.target.value;
      render();
      writeURL();
    }
  });

  // Chips + empty-state clear
  document.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-clear-group]");
    if (!chip) return;
    const { clearGroup: group, clearVal: val } = chip.dataset;
    if (group === "all") {
      ["category", "concern", "skin", "price"].forEach((g) => state[g].clear());
    } else {
      state[group].delete(val);
    }
    render();
    writeURL();
  });

  $("#resetFilters")?.addEventListener("click", () => {
    ["category", "concern", "skin", "price"].forEach((g) => state[g].clear());
    render();
    writeURL();
  });

  // Mobile filter panel
  const panel = $("#filtersPanel");
  const scrim = $("#scrim");
  $("#openFilters")?.addEventListener("click", () => {
    panel.classList.add("is-open");
    scrim.classList.add("is-open");
    document.body.classList.add("is-locked");
  });
  scrim?.addEventListener("click", () => {
    panel.classList.remove("is-open");
    scrim.classList.remove("is-open");
    document.body.classList.remove("is-locked");
  });

  window.addEventListener("popstate", () => {
    ["category", "concern", "skin", "price"].forEach((g) => state[g].clear());
    readURL();
    render();
  });
});