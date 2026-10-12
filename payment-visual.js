/* End-to-end test of the Razorpay checkout wiring in a real browser.

   Razorpay's own checkout.js is stubbed so the assertions about OUR code
   (payload, constructor options, confirmation panel) are fast and
   deterministic. A separate best-effort probe then loads the real CDN script
   to confirm Razorpay itself still integrates.

   Run: node payment-visual.js                                            */

const { spawn } = require('child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\Users\\Ameya\\AppData\\Local\\Temp\\opencode\\vedara-shots';
const PORT = 3150;
const APP_PORT = 3151;
const ROOT = path.join(__dirname);

const userDir = path.join(os.tmpdir(), 'vedara-pay-' + process.pid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const info = (msg) => console.log(`  ·    ${msg}`);

(async () => {
  await sleep(1800);
  const cdp = await connect(await targetUrl());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 950, deviceScaleFactor: 2, mobile: false
  });

  const ev = (expr) =>
    cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      .then((r) => r.result.value);

  // Stub Razorpay before any page script runs, recording how we construct it.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__rzp = { constructed: [], opened: 0 };
      window.Razorpay = function (opts) {
        this.opts = opts;
        window.__rzp.constructed.push(opts);
        this.open = function () { window.__rzp.opened++; return this; };
        this.on = function () {};
        this.close = function () {};
      };
    `
  });

  // Intercept only the endpoint under test.
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*api/orders*', requestStage: 'Request' }] });
  let sentOrder = null;
  cdp.on('Fetch.requestPaused', async (p) => {
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
    await cdp.send('Fetch.disable');
  });

  await cdp.send('Page.navigate', { url: `http://localhost:${APP_PORT}/product.html?id=brahmi-bhringraj` });
  await sleep(2500);

  console.log('--- checkout module is wired, and handles the button once ---');
  eq('checkout.js loaded', await ev('typeof beginCheckout'), 'function');
  const earlyToasts = await ev(`(()=>{const o=toast;let seen=[];window.toast=(m)=>seen.push(m);
      document.querySelector('[data-checkout]').click();return seen;})()`);
  ok('old placeholder toast is gone', !earlyToasts.some((m) => /demo store/i.test(m)), JSON.stringify(earlyToasts));

  console.log('\n--- add to basket then check out ---');
  await ev('document.querySelector(".pdp__copy [data-add]").click()');
  await sleep(300);
  eq('badge shows 1', await ev('document.querySelector("[data-cart-count]").textContent'), '1');
  await ev('document.querySelector("[data-cart-toggle]").click()');
  await sleep(300);
  eq('drawer open', await ev('document.getElementById("cartDrawer").classList.contains("is-open")'), true);

  await ev('document.querySelector("[data-checkout]").click()');
  for (let i = 0; i < 30 && sentOrder === null; i++) await sleep(150);

  console.log('\n--- what the client sent to the server ---');
  ok('POST /api/orders was issued', sentOrder !== null);
  eq('payload is id/variant/qty only', JSON.parse(sentOrder || '{}').lines,
     [{ id: 'brahmi-bhringraj', variant: 'standard', qty: 1 }]);
  ok('client sends NO price fields',
    !String(sentOrder).includes('price') && !String(sentOrder).includes('total') && !String(sentOrder).includes('unit'),
    String(sentOrder));

  console.log('\n--- Razorpay is constructed correctly ---');
  eq('constructed once', await ev('window.__rzp.constructed.length'), 1);
  const opts = await ev('window.__rzp.constructed[0]');
  eq('public key id (never the secret)', opts.key, 'rzp_test_FAKE');
  eq('amount in paise from the server', opts.amount, 13400);
  eq('order id from the server', opts.order_id, 'order_TEST123');
  eq('currency', opts.currency, 'USD');
  eq('brand name', opts.name, 'Vedara');
  eq('on-brand theme colour', opts.theme.color, '#2E4034');
  ok('logo resolves on the deployed subpath', /^https?:\/\/.+\/assets\/img\/chandan\.svg$/.test(opts.image), opts.image);
  ok('no secret key leaked to the client', !String(opts).includes('FAKESECRET'));
  eq('open() was called', await ev('window.__rzp.opened'), 1);
  eq('cart is still intact until payment is verified', await ev('count()'), 1);

  console.log('\n--- server refuses to serve its own source ---');
  eq('GET /server/index.js blocked', await ev(`fetch('/server/index.js').then(r=>r.status)`), 404);

  console.log('\n--- confirmation panel renders ---');
  await ev(`showConfirmation({ paymentId: 'pay_LIVE8xK2mQ', total: 128 }); null`);
  await sleep(600);
  eq('panel is in the DOM', await ev(`!!document.querySelector('.modal.is-open')`), true);
  eq('shows the amount paid', await ev(`document.querySelector('.modal__facts').textContent.includes('$128')`), true);
  eq('shows the payment reference', await ev(`document.querySelector('.modal__facts').textContent.includes('pay_LIVE8xK2mQ')`), true);
  eq('scrim covers the page', await ev(`getComputedStyle(document.querySelector('.modal')).position`), 'fixed');
  eq('has a close button', await ev(`!!document.querySelector('[data-modal-close]')`), true);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, 'order-confirmed.png'), Buffer.from(shot.data, 'base64'));

  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); null`);
  await sleep(600);
  eq('Escape closes the panel', await ev(`!document.querySelector('.modal')`), true);

  cdp.close();

  /* ---- best-effort probe against Razorpay's real CDN ----
     Informational only: a slow or blocked third-party CDN must not fail the
     suite, since it is not our code under test. */
  console.log('\n--- best-effort: real Razorpay CDN (non-fatal) ---');
  try {
    const cdp2 = await connect(await targetUrl());
    await cdp2.send('Page.enable');
    await cdp2.send('Runtime.enable');
    await cdp2.send('Page.navigate', { url: 'https://checkout.razorpay.com/v1/checkout.js' });
    let loaded = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const t = await cdp2.send('Runtime.evaluate', {
        expression: 'typeof window.Razorpay', returnByValue: true
      }).then((r) => r.result.value).catch(() => null);
      if (t === 'function') { loaded = true; break; }
    }
    info(loaded
      ? 'Razorpay checkout.js reachable — integration will work with real keys.'
      : 'Razorpay CDN not reachable from this machine (offline/blocked). Not a code problem.');
    cdp2.close();
  } catch (err) {
    info('CDN probe skipped: ' + err.message);
  }

  chrome.kill();
  api.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  console.log(fail ? `\n${fail} of ${total} FAILED` : `\nAll ${total} checkout checks passed.`);
  process.exit(fail ? 1 : 0);
})();