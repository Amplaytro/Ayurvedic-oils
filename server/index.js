/**
 * Vedara payments API.
 *
 * Zero dependencies — Node's built-in http and crypto only, so it deploys
 * anywhere without an npm install.
 *
 * Responsibilities:
 *   POST /api/orders   create a Razorpay order from the cart (server prices it)
 *   POST /api/verify   verify the payment signature after checkout completes
 *   POST /api/webhook  receive payment.captured / payment.failed notifications
 *   GET  /api/config   public Razorpay key id + store settings
 *   GET  /health       liveness probe
 *
 * The browser never sees RAZORPAY_KEY_SECRET. All amounts are recomputed
 * server-side from server/catalog.js, so a tampered cart cannot change what
 * the customer is charged.
 *
 * Run:  node server/index.js
 * Docs: see README.md
 */

'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { quote, PRODUCTS, CONFIG } = require('./catalog');

/* ---------------------------------------------------------------- .env load */

/**
 * Minimal .env loader so `node server/index.js` just works with no dotenv
 * dependency. Real environment variables always win, so host config and this
 * file cannot silently disagree.
 */
function loadEnvFile(file = path.join(__dirname, '..', '.env')) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return false; // no .env — rely on the real environment
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    let key = trimmed.slice(0, eq).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();

    let value = trimmed.slice(eq + 1).trim();
    // Strip matching quotes, if present.
    if (value.length > 1 &&
        ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }

    // Never clobber a real env var, and ignore blanks so an unfilled copy of
    // .env.example cannot blank out a host-provided value.
    if (value !== '' && process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

const loadedEnvFile = loadEnvFile();

/* ------------------------------------------------------------------ config */

const PORT = Number(process.env.PORT || 3000);
const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// Allow Pages (and any preview origin) to call the API. Set this to your real
// domain(s) in production, e.g. ALLOWED_ORIGINS="https://amplaytro.github.io".
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Where the static site lives. Served so the whole app can run from one
// process locally. Omit or set to a non-existent path in production if you
// want the API only (Pages serves the files).
const STATIC_ROOT = process.env.STATIC_ROOT || path.join(__dirname, '..');

const RAZORPAY_API = 'https://api.razorpay.com/v1';

if (!KEY_ID || !KEY_SECRET) {
  console.warn(
    '[vedara] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set.\n' +
    '[vedara] The site will serve, but /api/orders will return 503 until they are.\n' +
    '[vedara] Copy .env.example to .env and fill it in (see README for loading it).'
  );
}

/* ------------------------------------------------------------------ helpers */

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  });
  res.end(payload);
};

const cors = (req) => {
  const origin = req.headers.origin;
  if (!origin) return ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS[0] || null;
  return ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) ? origin : null;
};

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  // Length check first: timingSafeEqual throws on mismatched lengths.
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/** HMAC-SHA256 as hex — used for both payment and webhook signatures. */
function hmacHex(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function razorpayRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
    const payload = body === undefined ? null : JSON.stringify(body);
    const url = new URL(RAZORPAY_API + endpoint);

    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        },
        timeout: 20000
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed;
          try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(Object.assign(new Error(parsed.error?.description || 'Razorpay error'), {
            status: res.statusCode,
            razorpay: parsed
          }));
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Razorpay timed out')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* ------------------------------------------------------------------ static */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* Never serve these, even though they sit inside STATIC_ROOT. The server
   publishing its own source, workflow definitions or dotfiles would be an
   information leak. Rule of thumb: anything beginning with a dot, plus the
   server's own source directory. */
const DENY = [/^server(\/|$)/, /^node_modules(\/|$)/];

const isDenied = (relative) => {
  const normalised = relative.split('\\').join('/');
  // Any dot-prefixed segment (.env, .git, .github, .gitignore, ...).
  if (normalised.split('/').some((seg) => seg.startsWith('.'))) return true;
  return DENY.some((re) => re.test(normalised));
};

function serveStatic(req, res, urlPath) {
  // Resolve inside STATIC_ROOT only — blocks ../ traversal.
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, '') || 'index.html';
  if (isDenied(relative)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  const resolved = path.resolve(STATIC_ROOT, relative);
  if (resolved !== STATIC_ROOT && !resolved.startsWith(STATIC_ROOT + path.sep)) {
    return json(res, 403, { error: 'forbidden' });
  }

  fs.stat(resolved, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(resolved).pipe(res);
  });
}

/* ------------------------------------------------------------------ routes */

async function createOrder(req, res) {
  if (!KEY_ID || !KEY_SECRET) {
    return json(res, 503, { error: 'payments_not_configured' });
  }

  let body;
  try {
    body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
  } catch {
    return json(res, 400, { error: 'invalid_json' });
  }

  const result = quote(body.lines);
  if (!result.ok) return json(res, 400, { error: 'invalid_cart', detail: result.error });

  // Razorpay amounts are in the smallest currency unit (paise).
  const amountPaise = Math.round(result.total * 100);
  if (amountPaise < 100) {
    return json(res, 400, { error: 'invalid_cart', detail: 'order total is too small' });
  }

  try {
    const order = await razorpayRequest('POST', '/orders', {
      amount: amountPaise,
      currency: CONFIG.currency,
      receipt: `vedara_${Date.now().toString(36)}`,
      notes: {
        // Internal only — never trust these for fulfilment, but they help
        // reconcile an order in the Razorpay dashboard.
        line_count: String(result.lines.length),
        item_count: String(result.itemCount),
        cart: JSON.stringify(result.lines.map((l) => `${l.id}:${l.variant}:${l.qty}`)).slice(0, 900)
      }
    });

    json(res, 200, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: KEY_ID,
      // Echo the priced basket so the client can display exactly what it is
      // about to pay for.
      lines: result.lines,
      subtotal: result.subtotal,
      shipping: result.shipping,
      total: result.total
    });
  } catch (err) {
    console.error('[vedara] order creation failed:', err.message);
    json(res, 502, { error: 'order_creation_failed', detail: err.message });
  }
}

async function verifyPayment(req, res) {
  if (!KEY_ID || !KEY_SECRET) return json(res, 503, { error: 'payments_not_configured' });

  let body;
  try {
    body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
  } catch {
    return json(res, 400, { error: 'invalid_json' });
  }

  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  if (!orderId || !paymentId || !signature) {
    return json(res, 400, { error: 'missing_payment_details' });
  }

  const expected = hmacHex(KEY_SECRET, `${orderId}|${paymentId}`);
  if (!safeEqual(expected, signature)) {
    return json(res, 400, { error: 'signature_mismatch' });
  }

  // Signature proves the payment was made by us for that order. Confirm with
  // Razorpay that the order is actually captured before fulfilling.
  try {
    const payment = await razorpayRequest('GET', `/payments/${encodeURIComponent(paymentId)}`);
    const captured = payment.status === 'captured';
    json(res, 200, { ok: true, captured, status: payment.status, paymentId, orderId });
  } catch (err) {
    console.error('[vedara] payment lookup failed:', err.message);
    json(res, 502, { error: 'verification_failed', detail: err.message });
  }
}

async function webhook(req, res) {
  if (!WEBHOOK_SECRET) return json(res, 503, { error: 'webhook_not_configured' });

  const raw = await readBody(req);
  const signature = req.headers['x-razorpay-signature'];
  if (!signature || !safeEqual(hmacHex(WEBHOOK_SECRET, raw), signature)) {
    return json(res, 400, { error: 'signature_mismatch' });
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return json(res, 400, { error: 'invalid_json' });
  }

  // Fulfilment hooks go here — e.g. email a receipt, push to a fulfilment
  // queue, or decrement stock. Webhooks are the authoritative signal, since a
  // customer can close the browser before /api/verify returns.
  if (event.event === 'payment.captured') {
    const p = event.payload?.payment?.entity;
    console.log(`[vedara] payment.captured order=${p?.order_id} payment=${p?.id} amount=${p?.amount}`);
  } else if (event.event === 'payment.failed') {
    const p = event.payload?.payment?.entity;
    console.log(`[vedara] payment.failed order=${p?.order_id} reason=${p?.error_description || 'unknown'}`);
  }

  json(res, 200, { received: true });
}

/* ------------------------------------------------------------------ server */

const server = http.createServer(async (req, res) => {
  const origin = cors(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname === '/health') {
      return json(res, 200, { ok: true, payments: Boolean(KEY_ID && KEY_SECRET) });
    }

    if (url.pathname === '/api/config' && req.method === 'GET') {
      return json(res, 200, {
        keyId: KEY_ID,
        currency: CONFIG.symbol,
        freeShippingAt: CONFIG.freeShippingAt,
        flatRate: CONFIG.flatRate,
        configured: Boolean(KEY_ID && KEY_SECRET)
      });
    }

    if (url.pathname === '/api/orders' && req.method === 'POST') return await createOrder(req, res);
    if (url.pathname === '/api/verify' && req.method === 'POST') return await verifyPayment(req, res);
    if (url.pathname === '/api/webhook' && req.method === 'POST') return await webhook(req, res);

    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not_found' });

    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);

    json(res, 405, { error: 'method_not_allowed' });
  } catch (err) {
    console.error('[vedara] unhandled:', err);
    if (!res.headersSent) json(res, 500, { error: 'internal_error' });
  }
});

server.listen(PORT, () => {
  console.log(`[vedara] listening on http://localhost:${PORT}`);
  console.log(`[vedara] static root: ${STATIC_ROOT}`);
  console.log(`[vedara] payments: ${KEY_ID && KEY_SECRET ? 'configured' : 'NOT configured'}`);
  console.log(`[vedara] key source: ${loadedEnvFile ? '.env' : 'environment variables'}`);
  if (KEY_ID) console.log(`[vedara] key id: ${KEY_ID.slice(0, 8)}… (${KEY_ID.startsWith('rzp_test_') ? 'test' : KEY_ID.startsWith('rzp_live_') ? 'LIVE' : 'unknown mode'})`);
  console.log(`[vedara] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

module.exports = { server, createOrder, verifyPayment, webhook };