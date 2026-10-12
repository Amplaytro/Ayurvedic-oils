/* Captures screenshots with real device emulation via the DevTools protocol.
   (Chrome's --window-size flag is clamped to a minimum window width, which
   silently crops the capture, so emulation is the trustworthy path.)
   Run: node shoot.js <name> <page> <width> <height>                      */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'file:///C:/Users/Ameya/downloads/Ayurvedic%20website/';
const OUT = 'C:\\Users\\Ameya\\AppData\\Local\\Temp\\opencode\\vedara-shots';
const PORT = 9344;

const [name, page, w, h] = [
  process.argv[2] || 'shot',
  process.argv[3] || 'index.html',
  Number(process.argv[4] || 430),
  Number(process.argv[5] || 900)
];

const userDir = path.join(os.tmpdir(), 'vedara-shoot-' + process.pid);
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

(async () => {
  const cdp = await connect(await targetUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 2, mobile: w < 900
  });
  // VEDARA_URL overrides the local base, e.g. to shoot the deployed site.
  const target = process.env.VEDARA_URL || (BASE + page);
  await cdp.send('Page.navigate', { url: target });
  await sleep(2200);

  const scrollY = Number(process.argv[6] || 0);
  if (scrollY) {
    await cdp.send('Runtime.evaluate', {
      expression: `window.scrollTo({top:${scrollY},behavior:'instant'})`
    });
    await sleep(1200); // let scroll-reveal observers settle
  }

  const metrics = await cdp.send('Runtime.evaluate', {
    expression: 'JSON.stringify({vw:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth})',
    returnByValue: true
  });
  console.log('viewport', metrics.result.value);

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false
  });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(shot.data, 'base64'));
  console.log('wrote', path.join(OUT, name + '.png'));

  cdp.close();
  chrome.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  process.exit(0);
})();