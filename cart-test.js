const store = {};
const noop = () => {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.CustomEvent = class { constructor(t,o){ Object.assign(this,o); this.type=t; } };
global.document = {
  addEventListener: noop, querySelector: () => null, getElementById: () => null,
  querySelectorAll: () => [], dispatchEvent: noop,
  body: { classList: { add: noop, remove: noop, toggle: noop } }
};
const fs = require('fs'), vm = require('vm');
const ctx = { console, document: global.document, localStorage: global.localStorage,
              CustomEvent: global.CustomEvent, window: { addEventListener: noop }, setTimeout: noop };
vm.createContext(ctx);
for (const f of ['data.js','ui.js','cart.js'])
  vm.runInContext(fs.readFileSync('assets/js/'+f,'utf8'), ctx, { filename: f });
const C = vm.runInContext(
  '({addToCart,setQty,removeFromCart,clearCart,count,subtotal,total,shippingFor,peek:()=>cartItems,'+
  'loadCart,variantPrice,variantWas,PRODUCTS,money})', ctx);

let fail = 0, total = 0;
const eq = (label, got, want) => {
  total++; const ok = got === want; if (!ok) fail++;
  console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':`   got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const seed = raw => { store['vedara.cart.v1'] = raw; C.loadCart(); };

console.log('--- variant pricing ---');
eq('standard = list price',   C.variantPrice(C.PRODUCTS[0],'standard'), 34);
eq('trial  = round(34*.62)',   C.variantPrice(C.PRODUCTS[0],'trial'),    21);
eq('ritual = round(34*1.78)', C.variantPrice(C.PRODUCTS[0],'ritual'),   61);
eq('was price, trial',         C.variantWas(C.PRODUCTS[0],'trial'),      26);
eq('no sale -> no was',        C.variantWas(C.PRODUCTS[2],'standard'),    0);

console.log('\n--- free-shipping threshold ---');
eq('empty order ships free',  C.shippingFor(0), 0);
eq('$48 pays $6',             C.shippingFor(48), 6);
eq('$59 pays $6',             C.shippingFor(59), 6);
eq('$60 exactly is free',     C.shippingFor(60), 0);
eq('$129 free',               C.shippingFor(129), 0);

console.log('\n--- add, merge, sizes ---');
C.addToCart('brahmi-bhringraj','standard',2);
eq('count (units) = 2', C.count(), 2);
eq('subtotal = 68',   C.subtotal(), 68);
eq('68 >= 60 -> free shipping', C.total(), 68);
C.addToCart('brahmi-bhringraj','ritual',1);
eq('different size = new line', C.peek().length, 2);
eq('count = 3 units', C.count(), 3);
eq('subtotal = 34+34+61 = 129', C.subtotal(), 129);
C.addToCart('brahmi-bhringraj','standard',1);
eq('same size merges into one line', C.peek().length, 2);
eq('qty of that line = 3', C.peek()[0].qty, 3);
eq('count = 4 units', C.count(), 4);
eq('subtotal = 163', C.subtotal(), 163);

console.log('\n--- setQty / remove / clear ---');
C.setQty('brahmi-bhringraj','standard',1);
eq('count 2', C.count(), 2);
eq('subtotal 34+61 = 95', C.subtotal(), 95);
C.setQty('brahmi-bhringraj','ritual',0);
eq('qty 0 removes the line', C.peek().length, 1);
eq('subtotal 34', C.subtotal(), 34);
C.removeFromCart('brahmi-bhringraj','standard');
eq('remove empties basket', C.count(), 0);
eq('subtotal 0', C.subtotal(), 0);

console.log('\n--- persistence across a fresh session ---');
C.addToCart('tulsi-neem','trial',3);
const saved = store['vedara.cart.v1'];
eq('storage holds id/variant/qty/unit',
   JSON.parse(saved)[0].qty === 3 && JSON.parse(saved)[0].variant === 'trial' && JSON.parse(saved)[0].unit === 18, true);
C.clearCart();
eq('clear empties memory', C.count(), 0);
store['vedara.cart.v1'] = saved;      // simulate a brand-new session
C.loadCart();
eq('round-trip restores units', C.count(), 3);
eq('round-trip restores trial price (3 x 18)', C.subtotal(), 54);

console.log('\n--- hostile storage ---');
seed('{"not":"an array"}');
eq('garbage JSON object -> empty', C.count(), 0);
seed('not json at all');
eq('malformed JSON -> empty', C.count(), 0);
seed('');
eq('empty string -> empty', C.count(), 0);
seed(JSON.stringify([{id:'ghost-oil',qty:3},{id:'tulsi-neem',qty:2},{id:'amla-hair',qty:'x'},{id:'kansa-body'}]));
eq('unknown product dropped', C.count(), 2);
eq('valid lines kept', C.peek().every(i=>['tulsi-neem','amla-hair'].includes(i.id)), true);
eq('stale line repriced from catalogue (29*2)', C.subtotal(), 58);
seed(JSON.stringify([{id:'tulsi-neem',variant:'standard',qty:9999}]));
eq('qty clamped to 99', C.count(), 99);
seed(JSON.stringify([{id:'tulsi-neem',variant:'standard',qty:-5}]));
eq('negative qty clamped to 1', C.count(), 1);
seed(JSON.stringify([{id:'tulsi-neem',variant:'standard',qty:1.9}]));
eq('fractional qty floored to 1', C.count(), 1);

console.log('\n--- money formatting ---');
eq('$0',    C.money(0),    '$0');
eq('$68',   C.money(68),   '$68');
eq('$61.5', C.money(61.5), '$61.50');

console.log(fail ? `\n${fail} of ${total} FAILED` : `\nAll ${total} cart checks passed.`);
process.exit(fail?1:0);
