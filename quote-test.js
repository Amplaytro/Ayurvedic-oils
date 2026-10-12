const { quote } = require("./server/catalog.js");
const cases = [
  { name: "valid 2x standard", lines: [{id:"brahmi-bhringraj",variant:"standard",qty:2}], expect:{subtotal:68,shipping:0,total:68,itemCount:2} },
  { name: "valid 1x ritual",   lines: [{id:"brahmi-bhringraj",variant:"ritual",qty:1}],   expect:{subtotal:61,shipping:0,total:61,itemCount:1} },
  { name: "trial size priced", lines: [{id:"tulsi-neem",variant:"trial",qty:2}],         expect:{subtotal:36,shipping:6,total:42,itemCount:2} },
  { name: "duplicate lines merge", lines: [{id:"tulsi-neem",variant:"trial",qty:1},{id:"tulsi-neem",variant:"trial",qty:1}], expect:{subtotal:36,shipping:6,total:42,itemCount:2} },
  { name: "unknown product rejected", lines: [{id:"free-money",variant:"standard",qty:1}] },
  { name: "unknown size rejected",     lines: [{id:"tulsi-neem",variant:"platinum",qty:1}] },
  { name: "negative qty rejected",     lines: [{id:"tulsi-neem",variant:"trial",qty:-5}] },
  { name: "huge qty rejected",         lines: [{id:"tulsi-neem",variant:"trial",qty:99999}] },
  { name: "empty cart rejected",       lines: [] },
  { name: "non-array rejected",        lines: "nope" },
];
let bad = 0;
for (const c of cases) {
  const r = quote(c.lines);
  if (!c.expect) {
    const ok = r.ok === false;
    if (!ok) bad++;
    console.log(`${ok?"PASS":"FAIL"}  ${c.name} -> rejected (${r.error})`);
  } else {
    const ok = r.ok && r.subtotal===c.expect.subtotal && r.shipping===c.expect.shipping
                 && r.total===c.expect.total && r.itemCount===c.expect.itemCount;
    if (!ok) bad++;
    console.log(`${ok?"PASS":"FAIL"}  ${c.name} -> sub=${r.subtotal} ship=${r.shipping} total=${r.total} n=${r.itemCount}`);
  }
}
console.log(bad ? `\n${bad} FAILED` : "\nAll quote checks passed.");
process.exit(bad?1:0);

