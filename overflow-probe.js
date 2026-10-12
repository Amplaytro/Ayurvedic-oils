/* Measures horizontal overflow on each page at several viewport widths,
   using the Chrome DevTools Protocol directly (no dependencies).
   Run: node overflow-probe.js                                          */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'file:///C:/Users/Ameya/downloads/Ayurvedic%20website/';
const PAGES = ['index.html', 'shop.html', 'product.html?id=kansa-body', 'product.html'];
const WIDTHS = [360, 430, 768, 1024, 1440];
const PORT = 9333;

const userDir = path.join(os.tmpdir(), 'vedara-cdp-' + process.pid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + userDir,
  'about:blank'
], { stdio: 'ignore' });

async function targets() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not expose a debugging target');
}

/* Minimal CDP client over the global WebSocket (Node 22+) */
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
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
    });
  });
}

const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const docW = document.documentElement.scrollWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.mobile-nav, .drawer, .scrim, .strip__track')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 46)) || '',
        id: el.id || '',
        right: Math.round(r.right),
        width: Math.round(r.width)
      });
    }
  }
  // deepest offenders are the actual cause
  return { vw, docW, offenders: offenders.slice(0, 12) };
})()`;

(async () => {
  const cdp = await connect(await targets());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  let failures = 0;

  for (const width of WIDTHS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: width < 900
    });

    for (const page of PAGES) {
      await cdp.send('Page.navigate', { url: BASE + page });
      await sleep(1400);

      const res = await cdp.send('Runtime.evaluate', {
        expression: PROBE, returnByValue: true
      });
      const r = res.result.value;
      const overflow = r.docW - r.vw;
      const ok = overflow <= 1;

      if (!ok) failures++;
      console.log(
        `${ok ? 'PASS' : 'FAIL'}  ${String(width).padStart(4)}px  ${page.padEnd(28)} ` +
        `scrollW=${r.docW} clientW=${r.vw} overflow=${overflow}`
      );
      if (!ok) {
        r.offenders.forEach((o) =>
          console.log(`          └─ <${o.tag} id="${o.id}" class="${o.cls}"> right=${o.right} w=${o.width}`)
        );
      }
    }
  }

  cdp.close();
  chrome.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  console.log(failures ? `\n${failures} viewport(s) overflow.` : '\nNo horizontal overflow at any width.');
  process.exit(failures ? 1 : 0);
})();