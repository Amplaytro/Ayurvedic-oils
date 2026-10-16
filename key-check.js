/**
 * Validates your Razorpay credentials without ever printing the secret.
 *
 * Reads .env (or the real environment), then calls Razorpay's least-privilege
 * endpoint. Prints only the key id's first 8 characters and a pass/fail.
 *
 * Run: node key-check.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// Reuse the same loader the server uses, so both behave identically.
const serverSource = fs.readFileSync(path.join(__dirname, 'server', 'index.js'), 'utf8');
const loaderMatch = serverSource.match(/function loadEnvFile[\s\S]*?\n}/);
if (loaderMatch) {
  // eslint-disable-next-line no-new-func
  const loadEnvFile = new Function('path', 'fs', `${loaderMatch[0]}; return loadEnvFile;`)(path, fs);
  loadEnvFile(path.join(__dirname, '.env'));
}

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

const mask = (s) => (s.length > 8 ? s.slice(0, 8) + '…' + s.slice(-4) : s);

function get(endpoint) {
  return new Promise((resolve) => {
    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
    const url = new URL('https://api.razorpay.com/v1' + endpoint);
    const req = https.request(
      {
        method: 'GET',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: { Authorization: `Basic ${auth}` },
        timeout: 20000
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let body = {};
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ status: 0, body: { error: { description: e.message } } }));
    req.end();
  });
}

(async () => {
  console.log('[keys] checking Razorpay credentials\n');

  if (!KEY_ID || !KEY_SECRET) {
    console.log('  MISSING  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET');
    console.log('\n  Create .env next to README.md and fill in both values.');
    console.log('  Get them from Razorpay Dashboard -> Account & Settings ->');
    console.log('  Developer Controls -> API Keys -> Generate Key (Test mode).');
    console.log('  The secret is shown only once — copy both values immediately.');
    process.exit(1);
  }

  const mode = KEY_ID.startsWith('rzp_live_') ? 'LIVE' : KEY_ID.startsWith('rzp_test_') ? 'TEST' : 'UNKNOWN';
  console.log(`  key id    ${mask(KEY_ID)}  (${mode} mode)`);
  console.log(`  secret    ${'*'.repeat(Math.min(12, KEY_SECRET.length))}  (${KEY_SECRET.length} chars, not shown)`);

  const res = await get('/account');
  if (res.status === 200 && res.body && res.body.id) {
    console.log(`\n  PASS      Credentials are valid.`);
    console.log(`  account   ${res.body.business_name || res.body.entity_type || 'n/a'}`);
    console.log('\n  Start the server:  node server/index.js');
    console.log('  Then open http://localhost:3000 and place a test order.');
    console.log('\n  Test cards (Razorpay):');
    console.log('    success  4111 1111 1111 1111   any future expiry, any CVV');
    console.log('    failure  4000 0000 0000 0002');
    console.log('    test UPI success@ybl / failure@ybl');
    process.exit(0);
  }

  const desc = res.body?.error?.description || res.body?.message || `HTTP ${res.status}`;
  console.log(`\n  FAILED   ${desc}`);
  if (res.status === 401) {
    console.log('\n  That usually means the key id and secret do not belong together,');
    console.log('  or you mixed TEST keys with LIVE keys. They are separate sets.');
  }
  process.exit(1);
})();