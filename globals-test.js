/* Classic <script> tags share ONE global lexical scope. If two of them declare
   the same top-level `const`/`let`/`class`, the second file throws a
   SyntaxError and is silently dropped — a whole feature disappears with no
   console-visible cause attached to the markup.

   This runs every page script in a shared context and reports collisions,
   plus any other error raised during evaluation.

   Run: node globals-test.js                                              */

const fs = require('node:fs');
const vm = require('node:vm');

const SCRIPTS = [
  'data.js', 'cart.js', 'ui.js', 'home.js', 'shop.js', 'product.js', 'checkout.js'
].map((f) => 'assets/js/' + f);

/* Only column-0 declarations matter: an indented `const` is inside a function
   and therefore block-scoped, which cannot collide across files. */
const TOP_LEVEL = /^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/;

const declaredBy = new Map();
const collisions = [];
let fail = 0, total = 0;

console.log('--- scanning for duplicate top-level declarations ---');
for (const file of SCRIPTS) {
  const src = fs.readFileSync(file, 'utf8');
  for (const line of src.split('\n')) {
    const m = line.match(TOP_LEVEL);
    if (!m) continue;
    const name = m[1];
    if (declaredBy.has(name)) {
      collisions.push({ name, a: declaredBy.get(name), b: file });
    } else {
      declaredBy.set(name, file);
    }
  }
}

total += 1;
if (collisions.length) {
  fail++;
  console.log('  FAIL — collisions found:');
  for (const c of collisions) console.log(`    "${c.name}" in ${c.a} and ${c.b}`);
} else {
  console.log(`  PASS — ${declaredBy.size} top-level names, no duplicates`);
}

console.log('\n--- evaluating every script in one shared context ---');
const context = vm.createContext({
  console, URLSearchParams, URL, Buffer,
  document: {
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null, dispatchEvent() {}, createElement: () => ({ setAttribute() {}, addEventListener() {} }),
    head: { appendChild() {} }, body: { classList: { add() {}, remove() {} } },
    documentElement: { dataset: {} }
  },
  window: { addEventListener() {}, scrollY: 0 },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  history: { replaceState() {} },
  location: { search: '', href: 'http://localhost/' },
  CustomEvent: class {},
  IntersectionObserver: undefined,
  fetch: () => Promise.reject(new Error('no network in tests')),
  setTimeout: () => {},
  navigator: {}
});
context.globalThis = context;

for (const file of SCRIPTS) {
  total++;
  try {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
    console.log(`  PASS  ${file}`);
  } catch (err) {
    fail++;
    console.log(`  FAIL  ${file}  -> ${err.name}: ${err.message}`);
  }
}

console.log('\n--- checkout.js must expose its entry point ---');
/* `const` bindings live in the context's lexical scope, not on the global
   object, so they must be read by evaluating inside the context. */
const probe = (expr) => vm.runInContext(expr, context);

total++;
if (probe('typeof beginCheckout') === 'function') {
  console.log('  PASS  beginCheckout is defined');
} else {
  fail++;
  console.log(`  FAIL  beginCheckout is ${probe('typeof beginCheckout')}`);
}

total++;
if (probe('typeof money') === 'function') {
  console.log('  PASS  shared money() survived');
} else {
  fail++;
  console.log('  FAIL  money() is missing');
}

total++;
if (probe('money(1234.5)') === '$1,234.50') {
  console.log('  PASS  money() formats correctly across files');
} else {
  fail++;
  console.log(`  FAIL  money() returned ${probe('money(1234.5)')}`);
}

console.log(fail ? `\n${fail} of ${total} FAILED` : `\nAll ${total} global-scope checks passed.`);
process.exit(fail ? 1 : 0);