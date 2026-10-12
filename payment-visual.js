/* End-to-end test of the Razorpay checkout wiring in a real browser.
   Intercepts POST /api/orders so we can assert what the client sends and then
   stub a success, which makes the real Razorpay modal open.

   Run: node payment-visual.js                                            */

const { spawn } = require('child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\Users\\Ameya\\AppData\\Local\\Temp\\opencode\\vedara-shots';
const PORT = 3120;
const APP_PORT = 3121;
const ROOT = path.join(__dirname);

const userDir = path.join(os.tmpdir(), 'vedara-pay-' + process.pid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- API server under test (fake keys) ---------------------------------- */
const api = spawn(process.execPath, ['server/index.js'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(APP_PORT),
    RAZORPAY_KEY_ID: 'rzp_test_FAKE',
    RAZORPAY_KEY_SECRET: 'FAKESECRET0123456789'
  },
  stdio: 'ignore'
});

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir, 'about:blank'
], { stdio: 'ignore' });

async function targetUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const t = list.find((x) => x.type === 'page');
      if (t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no chrome target');
}

/* --- CDP client with event support -------------------------------------- */
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const handlers = new Map();
    ws.addEventListener('open', () =>
      resolve({
        send(method, params = {}) {
          const msgId = ++id;
          ws.send(JSON.stringify({ id: msgId, method, params }));
          return new Promise((res, rej) => pending.set(msgId, { res, rej }));
        },
        on(method, fn) {
          if (!handlers.has(method)) handlers.set(method, []);
          handlers.get(method).push(fn);
        },
        close: () => ws.close()
      })
    );
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      } else if (m.method && handlers.has(m.method)) {
        handlers.get(m.method).forEach((fn) => fn(m.params));
      }
    });
  });
}

let fail = 0, total = 0;
const eq = (label, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got=${JSON.stringify(got)}\n        want=${JSON.stringify(want)}`}`);
};
const ok = (label, cond, detail = '') => {
  total++;
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : '  ' + detail}`);
};

(async () => {
  await sleep(1800); // let the API bind
  const cdp = await connect(await targetUrl());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });

  const ev = (expr) =>
    cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      .then((r) => r.result.value);

  /* Intercept /api/orders: capture the body, return a stubbed success so the
     real Razorpay modal can open. */
  let sentOrder = null;
  cdp.on('Fetch.requestPaused', async (p) => {
    if (p.request.url.endsWith('/api/orders')) {
      sentOrder = p.request.postData;
      const stub = JSON.stringify({
        orderId: 'order_TEST123',
        amount: 13400,
        currency: 'USD',
        keyId: 'rzp_test_FAKE',
        lines: [{ id: 'brahmi-bhringraj', name: 'Brahmi & Bhringraj Scalp Oil', variant: 'ritual', variantLabel: 'Ritual · 200ml', qty: 1, unit: 122, lineTotal: 122 }],
        subtotal: 122, shipping: 6, total: 128
      });
      await cdp.send('Fetch.fulfillRequest', {
        requestId: p.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(stub, 'utf8').toString('base64')
      });
      return;
    }
    await cdp.send('Fetch.continueRequest', { requestId: p.requestId });
  });

  await cdp.send('Page.navigate', { url: `http://localhost:${APP_PORT}/product.html?id=brahmi-bhringraj` });
  await sleep(2500);

  console.log('--- checkout module is wired, and handles the button once ---');
  eq('checkout.js loaded', await ev('typeof beginCheckout'), 'function');
  // Clicking checkout on an empty basket may legitimately toast "Your basket
  // is empty" — what must NOT appear is the old placeholder message.
  const earlyToasts = await ev(`(()=>{const o=toast;let seen=[];window.toast=(m)=>seen.push(m);
      document.querySelector('[data-checkout]').click();return seen;})()`);
  ok('old placeholder toast is gone',
    !earlyToasts.some((m) => /demo store/i.test(m)),
    JSON.stringify(earlyToasts));

  console.log('\n--- add to basket then check out ---');
  await ev('document.querySelector(".pdp__copy [data-add]").click()');
  await sleep(400);
  eq('badge shows 1', await ev('document.querySelector("[data-cart-count]").textContent'), '1');

  await ev('document.querySelector("[data-cart-toggle]").click()');
  await sleep(400);
  eq('drawer open', await ev('document.getElementById("cartDrawer").classList.contains("is-open")'), true);

  await ev('document.querySelector("[data-checkout]").click()');
  await sleep(1200);

  console.log('\n--- what the client sent to the server ---');
  ok('POST /api/orders was issued', sentOrder !== null);
  const parsed = JSON.parse(sentOrder || '{}');
  eq('payload is id/variant/qty only', parsed.lines, [{ id: 'brahmi-bhringraj', variant: 'standard', qty: 1 }]);
  ok('client sends NO price fields',
    !sentOrder.includes('price') && !sentOrder.includes('total') && !sentOrder.includes('unit'),
    sentOrder);

  console.log('\n--- Razorpay checkout actually opens ---');
  eq('Razorpay script loaded from CDN', await ev('typeof window.Razorpay'), 'function');
  // Razorpay injects its modal into the DOM when open() is called.
  const modalUp = await ev(`!!document.querySelector('iframe[src*="razorpay"], #razorpay-checkout-frame, .razorpay-checkout-frame')`);
  ok('Razorpay modal iframe present in DOM', modalUp);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, 'razorpay-modal.png'), Buffer.from(shot.data, 'base64'));

  console.log('\n--- server refuses to serve its own source ---');
  const code = await ev(`fetch('/server/index.js').then(r=>r.status)`);
  eq('GET /server/index.js blocked', code, 404);

  cdp.close();
  chrome.kill();
  api.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  console.log(fail ? `\n${fail} of ${total} FAILED` : `\nAll ${total} checkout checks passed.`);
  process.exit(fail ? 1 : 0);
})();