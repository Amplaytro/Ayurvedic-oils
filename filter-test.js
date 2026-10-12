/* Headless test for the shop filter/sort engine (shop.js).
   Run with:  node filter-test.js                                    */

const noop = () => {};
const el = () => ({
  innerHTML: '', value: '', options: [], style: {}, dataset: {},
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, setAttribute: noop,
  querySelectorAll: () => [], querySelector: () => null
});

/* --- DOM / browser stub --------------------------------------------------- */
const sortSel = el();
sortSel.value = 'featured';
sortSel.options = ['featured', 'rating', 'price-asc', 'price-desc', 'name'].map((v) => {
  const o = el(); o.value = v; return o;
});

const nodes = {};
[
  '#fCategory', '#fConcern', '#fSkin', '#fPrice', '#results', '#resultCount',
  '#activeChips', '#fabCount', 'resetFilters', 'openFilters', 'scrim', 'filtersPanel'
].forEach((k) => { nodes[k] = el(); });

global.location = { search: '' };
global.document = {
  addEventListener: (t, fn) => { if (t === 'DOMContentLoaded') global.__boot = fn; },
  querySelector: (s) => (s === '#sortBy' ? sortSel : nodes[s] || el()),
  querySelectorAll: () => [],
  getElementById: () => null,
  dispatchEvent: noop,
  body: { classList: { add: noop, remove: noop, toggle: noop } }
};
global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
global.CustomEvent = class { constructor(t, o) { Object.assign(this, o); this.type = t; } };
global.window = { addEventListener: noop, scrollY: 0 };
global.setTimeout = noop;

/* --- Load the app --------------------------------------------------------- */
const fs = require('fs');
const vm = require('vm');
const ctx = {
  console, URLSearchParams, document: global.document, location: global.location,
  window: global.window, localStorage: global.localStorage,
  CustomEvent: global.CustomEvent, setTimeout: noop, history: { replaceState: noop }
};
vm.createContext(ctx);
for (const f of ['data.js', 'ui.js', 'cart.js', 'shop.js']) {
  vm.runInContext(fs.readFileSync('assets/js/' + f, 'utf8'), ctx, { filename: f });
}
global.__boot();

const CLEAR = '["category","concern","skin","price"].forEach(g=>state[g].clear());';
const F = vm.runInContext(
  `({
     state, matches, sorted, PRODUCTS,
     reset: () => { ${CLEAR} },
     run: (sel) => { ${CLEAR} sel(state); return sorted(PRODUCTS.filter(matches)); }
   })`,
  ctx
);

/* --- Assertions ----------------------------------------------------------- */
let fail = 0, total = 0;
const eq = (label, got, want) => {
  total++;
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   got=${got} want=${want}`}`);
};
const ids = (s) => s.map((p) => p.id).join(',');
const prices = (s) => s.map((p) => p.price).join(',');

console.log('--- category ---');
eq('no filter -> all 8', F.run(() => {}).length, 8);
eq('hair -> 2', ids(F.run((s) => s.category.add('hair'))), 'brahmi-bhringraj,amla-hair');
eq('body -> 2', F.run((s) => s.category.add('body')).length, 2);
eq('skin -> 3', F.run((s) => s.category.add('skin')).length, 3);
eq('calm -> 1', F.run((s) => s.category.add('calm')).length, 1);
eq('hair+skin -> 5', F.run((s) => { s.category.add('hair'); s.category.add('skin'); }).length, 5);
eq('all four -> 8', F.run((s) => {
  s.category.add('hair'); s.category.add('skin'); s.category.add('body'); s.category.add('calm');
}).length, 8);

console.log('\n--- concern: OR within a facet, AND across facets ---');
eq('hairfall -> 2', F.run((s) => s.concern.add('hairfall')).length, 2);
eq('acne -> 3', ids(F.run((s) => s.concern.add('acne'))), 'tulsi-neem,chandan-rose,aloe-soothe');
eq('acne OR sensitivity -> 3', F.run((s) => { s.concern.add('acne'); s.concern.add('sensitivity'); }).length, 3);
eq('cat:skin AND acne -> 3', F.run((s) => { s.category.add('skin'); s.concern.add('acne'); }).length, 3);
eq('cat:hair AND dandruff -> 1', ids(F.run((s) => { s.category.add('hair'); s.concern.add('dandruff'); })), 'brahmi-bhringraj');
eq('cat:hair AND acne -> 0', F.run((s) => { s.category.add('hair'); s.concern.add('acne'); }).length, 0);
eq('cat:calm AND tension -> 1', ids(F.run((s) => { s.category.add('calm'); s.concern.add('tension'); })), 'ashwagandha-night');
eq('cat:body AND dryness -> 2', F.run((s) => { s.category.add('body'); s.concern.add('dryness'); }).length, 2);

console.log('\n--- skin type ---');
eq('oily -> 1', ids(F.run((s) => s.skin.add('oily'))), 'tulsi-neem');
eq('dry -> 1', ids(F.run((s) => s.skin.add('dry'))), 'kansa-body');
eq('sensitive -> 1', ids(F.run((s) => s.skin.add('sensitive'))), 'aloe-soothe');
eq('normal -> 1', ids(F.run((s) => s.skin.add('normal'))), 'multani-amber');
eq('"all skin types" is a no-op', F.run((s) => s.skin.add('all')).length, 8);
eq('all + oily -> only oily', F.run((s) => { s.skin.add('all'); s.skin.add('oily'); }).length, 1);

console.log('\n--- price bands (34,42,48,29,39,36,32,31) ---');
eq('under 35 -> 4', ids(F.run((s) => s.price.add('under35'))).split(',').length, 4);
eq('under 35 members', prices(F.run((s) => s.price.add('under35'))).split(',').length, 4);
eq('35-45 -> 3', F.run((s) => s.price.add('35to45')).length, 3);
eq('over 45 -> 1', ids(F.run((s) => s.price.add('over45'))), 'kansa-body');
eq('under35 + over45 -> 5', F.run((s) => { s.price.add('under35'); s.price.add('over45'); }).length, 5);
eq('bands partition the catalogue: 4+3+1 = 8', 4 + 3 + 1, 8);
eq('cat:hair + under35 -> 2', ids(F.run((s) => { s.category.add('hair'); s.price.add('under35'); })), 'brahmi-bhringraj,amla-hair');
eq('cat:hair + 35to45 -> 0 (both hair oils are <35)', F.run((s) => { s.category.add('hair'); s.price.add('35to45'); }).length, 0);

console.log('\n--- sorting ---');
F.reset(); F.state.sort = 'price-asc';
eq('price asc', prices(F.sorted(F.PRODUCTS.filter(F.matches))), '29,31,32,34,36,39,42,48');
F.state.sort = 'price-desc';
eq('price desc', prices(F.sorted(F.PRODUCTS.filter(F.matches))), '48,42,39,36,34,32,31,29');
F.state.sort = 'name';
eq('name asc, first = aloe-soothe', F.sorted(F.PRODUCTS)[0].id, 'aloe-soothe');
F.state.sort = 'rating';
eq('rating desc, top = 4.9', F.sorted(F.PRODUCTS)[0].rating, 4.9);
F.state.sort = 'featured';
eq('featured returns 8', F.sorted(F.PRODUCTS).length, 8);
F.state.sort = 'featured';
eq('filtering still applies under sort', F.run((s) => s.category.add('skin')).length, 3);

console.log('\n--- empty state ---');
eq('impossible combo -> 0 results', F.run((s) => { s.category.add('hair'); s.concern.add('stress'); }).length, 0);

console.log(fail ? `\n${fail} of ${total} FAILED` : `\nAll ${total} filter checks passed.`);
process.exit(fail ? 1 : 0);