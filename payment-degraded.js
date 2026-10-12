/* Verifies the checkout degrades gracefully when the payments API is not
   deployed (the current state of the live Pages site).
   Run: node payment-degraded.js                                          */

const { spawn } = require('child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 3140;
const SITE = process.argv[2] || 'https://amplaytro.github.io/Ayurvedic-oils/index.html';

const userDir = path.join(os.tmpdir(), 'vedara-deg-' + process.pid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

let fail = 0, total = 0;
const ok = (label, cond, detail = '') => {
  total++;
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : '  ' + detail}`);
};

(async () => {
  const cdp = await connect(await targetUrl());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 2, mobile: false
  });

  const ev = (expr) =>
    cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      .then((r) => r.result.value);

  await cdp.send('Page.navigate', { url: SITE });
  await sleep(3500);

  console.log(`testing: ${SITE}\n`);

  ok('checkout module loaded on the live site', await ev('typeof beginCheckout') === 'function');

  // Put something in the basket, open the drawer, click checkout.
  await ev('addToCart("tulsi-neem","trial",2)');
  await sleep(400);
  await ev('openCart()');
  await sleep(400);

  // Capture whatever toast the customer would see.
  const toasts = await ev(`(async () => {
      const seen = [];
      const orig = toast;
      window.toast = (m) => { seen.push(m); return orig(m); };
      document.querySelector('[data-checkout]').click();
      await new Promise(r => setTimeout(r, 2500));
      return seen;
  })()`);

  ok('a customer-facing message was shown', toasts.length > 0, JSON.stringify(toasts));
  const msg = (toasts[0] || '').toLowerCase();
  ok('message is human, not a raw status code',
    !/\b(404|500|502|undefined|null|request failed)\b/.test(msg), JSON.stringify(toasts));
  console.log(`        -> "${toasts[0]}"`);

  ok('basket is preserved after a failed checkout', await ev('count()') === 2);
  ok('no Razorpay modal was left open',
    !(await ev(`!!document.querySelector('.razorpay-checkout-frame, iframe[src*="razorpay"]')`)));

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(
    'C:\\Users\\Ameya\\AppData\\Local\\Temp\\opencode\\vedara-shots\\degraded-checkout.png',
    Buffer.from(shot.data, 'base64')
  );

  cdp.close();
  chrome.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  console.log(fail ? `\n${fail} of ${total} FAILED` : `\nAll ${total} degraded-mode checks passed.`);
  process.exit(fail ? 1 : 0);
})();