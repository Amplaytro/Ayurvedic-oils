/* Drives a real browser: clicks "Add to basket" on a product card, opens the
   cart drawer, and screenshots the result. Run: node cart-visual.js        */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\Users\\Ameya\\AppData\\Local\\Temp\\opencode\\vedara-shots';
const PORT = 9355;
const userDir = path.join(os.tmpdir(), 'vedara-cv-' + process.pid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir, 'about:blank'
], { stdio: 'ignore' });

async function targetUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const t = list.find((x) => x.type === 'page');
      if (t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('no target');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const msgId = ++id;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return new Promise((res, rej) => pending.set(msgId, { res, rej }));
      },
      close: () => ws.close()
    }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    });
  });
}

const evaluate = (cdp, expression) =>
  cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    .then((r) => r.result.value);

let fail = 0;
const eq = (label, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

(async () => {
  const cdp = await connect(await targetUrl());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 950, deviceScaleFactor: 2, mobile: false
  });

  await cdp.send('Page.navigate', {
    url: 'file:///C:/Users/Ameya/downloads/Ayurvedic%20website/product.html?id=brahmi-bhringraj'
  });
  await sleep(2200);

  console.log('--- product page renders ---');
  eq('title set from product', await evaluate(cdp, 'document.title'),
     'Brahmi & Bhringraj Scalp Oil — Vedara');
  eq('price defaults to Standard', await evaluate(cdp, 'document.querySelector("[data-price]").textContent'), '$34');
  eq('size buttons', await evaluate(cdp, 'document.querySelectorAll("[data-variant]").length'), 3);
  eq('botanical section shown', await evaluate(cdp, 'getComputedStyle(document.getElementById("botanicalSection")).display !== "none"'), true);
  eq('3 ingredient cards rendered', await evaluate(cdp, 'document.querySelectorAll("#botanicalGrid .ing").length'), 3);
  eq('3 related cards rendered', await evaluate(cdp, 'document.querySelectorAll("#relatedGrid .card").length'), 3);
  eq('FAQ subset rendered', await evaluate(cdp, 'document.querySelectorAll("[data-faq] .acc__item").length'), 8);

  console.log('\n--- switching size reprices ---');
  await evaluate(cdp, 'document.querySelectorAll(".opts [data-variant]")[2].click()'); // Ritual
  await sleep(300);
  eq('ritual price', await evaluate(cdp, 'document.querySelector("[data-price]").textContent'), '$61');
  eq('was price repriced', await evaluate(cdp, 'document.querySelector("[data-was]").textContent'), '$75');
  eq('button label repriced', await evaluate(cdp, 'document.querySelector("[data-btn-price]").textContent'), '$61');

  console.log('\n--- add 2 x Ritual to the basket ---');
  await evaluate(cdp, 'document.querySelector("[data-qty-inc]").click()');
  await sleep(150);
  eq('qty = 2', await evaluate(cdp, 'document.querySelector("[data-qty-input]").value'), '2');
  await evaluate(cdp, 'document.querySelector(".pdp__copy [data-add]").click()');
  await sleep(600);

  eq('badge shows 2', await evaluate(cdp, 'document.querySelector("[data-cart-count]").textContent'), '2');
  eq('badge visible', await evaluate(cdp, 'document.querySelector("[data-cart-count]").classList.contains("is-visible")'), true);
  eq('stored in localStorage', await evaluate(cdp,
    'JSON.parse(localStorage.getItem("vedara.cart.v1")).map(i=>i.variant+":"+i.qty+":"+i.unit).join()'), 'ritual:2:61');

  console.log('\n--- drawer opens and renders ---');
  await evaluate(cdp, 'document.querySelector("[data-cart-toggle]").click()');
  await sleep(800);
  eq('drawer open', await evaluate(cdp, 'document.getElementById("cartDrawer").classList.contains("is-open")'), true);
  eq('one line item', await evaluate(cdp, 'document.querySelectorAll(".line-item").length'), 1);
  eq('line shows variant label', await evaluate(cdp, 'document.querySelector(".line-item__var").textContent'), 'Ritual · 200ml · $61');
  eq('line total = 2 x 61', await evaluate(cdp, 'document.querySelector(".line-item__price").textContent'), '$122');
  eq('free shipping message', await evaluate(cdp, 'document.querySelector("[data-cart-ship]").textContent.trim()'),
     'Free shipping unlocked. Thank you.');
  eq('progress bar full', await evaluate(cdp, 'document.querySelector(".ship-bar i").style.width'), '100%');
  eq('totals rendered', await evaluate(cdp, 'document.querySelector("[data-cart-totals]").textContent.replace(/\\s+/g," ").trim()'),
     'Subtotal$122 Shipping Free Total$122');

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, 'cart-drawer.png'), Buffer.from(shot.data, 'base64'));
  console.log('\nwrote cart-drawer.png');

  console.log('\n--- incrementing inside the drawer ---');
  await evaluate(cdp, 'document.querySelector("[data-inc]").click()');
  await sleep(400);
  eq('qty 3 -> subtotal 183', await evaluate(cdp, 'document.querySelector(".line-item__price").textContent'), '$183');
  eq('badge now 3', await evaluate(cdp, 'document.querySelector("[data-cart-count]").textContent'), '3');

  console.log('\n--- emptying the basket shows the empty state ---');
  await evaluate(cdp, 'document.querySelector("[data-del]").click()');
  await sleep(500);
  eq('no line items', await evaluate(cdp, 'document.querySelectorAll(".line-item").length'), 0);
  eq('empty message shown', await evaluate(cdp, '!!document.querySelector(".drawer__empty")'), true);
  eq('badge hidden at 0', await evaluate(cdp, 'document.querySelector("[data-cart-count]").classList.contains("is-visible")'), false);

  console.log('\n--- unknown product id falls back gracefully ---');
  await cdp.send('Page.navigate', {
    url: 'file:///C:/Users/Ameya/downloads/Ayurvedic%20website/product.html?id=does-not-exist'
  });
  await sleep(1800);
  eq('friendly empty state', await evaluate(cdp, '!!document.querySelector("#pdp .empty")'), true);
  eq('no crash: botanicals hidden', await evaluate(cdp, 'document.getElementById("botanicalGrid").children.length'), 0);

  cdp.close();
  chrome.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  console.log(fail ? `\n${fail} FAILED` : '\nAll end-to-end browser checks passed.');
  process.exit(fail ? 1 : 0);
})();