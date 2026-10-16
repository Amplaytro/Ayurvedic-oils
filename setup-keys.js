/**
 * Writes your Razorpay keys into .env using masked terminal input.
 *
 * Why this exists: the key secret should never be typed on screen where it can
 * be shoulder-surfed, never passed as a command argument where it lands in
 * shell history, and never pasted into a chat. Here you paste it once into a
 * hidden prompt, and it is written straight to .env (which is git-ignored).
 *
 * Run: node setup-keys.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ENV_FILE = path.join(__dirname, '.env');

const isTTY = process.stdin.isTTY && process.stdout.isTTY;
let askRaw;
let inputReady = Promise.resolve();

if (isTTY) {
  /**
   * Ask a question and read the answer without echoing it.
   * @param {string} question
   * @returns {Promise<string>}
   */
  askRaw = (question) =>
    new Promise((resolve) => {
      process.stdout.write(question);
      const input = process.stdin;
      const wasRaw = input.isRaw;

      if (input.setRawMode) input.setRawMode(true);
      input.resume();
      input.setEncoding('utf8');

      let value = '';
      let done = false;
      const onData = (chunk) => {
        for (const ch of chunk) {
          if (done) return;
          if (ch === '\r' || ch === '\n') { // Enter
            done = true;
            process.stdout.write('\n');
            input.removeListener('data', onData);
            if (input.setRawMode) input.setRawMode(wasRaw || false);
            input.pause();
            return resolve(value);
          }
          if (ch === '\u0003') { // Ctrl+C
            process.stdout.write('\nCancelled.\n');
            process.exit(130);
          }
          if (ch === '\b' || ch === '\u007f') { // Backspace
            if (value.length) {
              value = value.slice(0, -1);
              // Erase the asterisk we already printed.
              if (process.stdout.isTTY) process.stdout.write('\b \b');
            }
            continue;
          }
          if (ch >= ' ') { // ignore other control characters
            value += ch;
            if (process.stdout.isTTY) process.stdout.write('*');
          }
        }
      };
      input.on('data', onData);
    });
} else {
  /* Piped input: read every line up front and hand them out in order, so
     scripted use answers the prompts predictably. */
  inputReady = new Promise((resolve) => {
    const lines = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => lines.push(...c.split(/\r?\n/)));
    process.stdin.on('end', () => resolve(lines));
    process.stdin.on('close', () => resolve(lines));
  }).then((lines) => {
    let idx = 0;
    askRaw = async (question) => {
      process.stdout.write(question);
      const value = (lines[idx++] || '').trim();
      process.stdout.write('(hidden)\n');
      return value;
    };
  });
}

const prompt = async () => {
  await inputReady;
  console.log('\n  Razorpay key setup');
  console.log('  ------------------');
  console.log('  Keys live in: Dashboard -> Account & Settings -> Developer');
  console.log('  Controls -> API Keys -> Generate Key (use TEST mode first).');
  console.log('');
  console.log('  The secret is shown by Razorpay only once. Paste it now.');
  console.log('');

  const keyId = (await askRaw('  Key ID   (visible, public): ')).trim();
  if (!keyId) {
    console.error('\n  No key id entered. Nothing written.\n');
    process.exit(1);
  }
  if (!/^rzp_(test|live)_/.test(keyId)) {
    console.error(`\n  "${keyId}" does not look like a Razorpay key id (expected rzp_test_… or rzp_live_…).`);
    const proceed = (await askRaw('  Write it anyway? (y/N): ')).trim().toLowerCase();
    if (proceed !== 'y') {
      console.error('  Cancelled. Nothing written.\n');
      process.exit(1);
    }
  }

  const secret = (await askRaw('  Secret   (hidden): ')).trim();
  if (!secret) {
    console.error('\n  No secret entered. Nothing written.\n');
    process.exit(1);
  }

  // Preserve anything else already in .env (PORT, origins, webhook secret).
  let existing = {};
  try {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      existing[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    /* first run */
  }

  existing.RAZORPAY_KEY_ID = keyId;
  existing.RAZORPAY_KEY_SECRET = secret;

  const order = [
    '# Razorpay keys — generated from Dashboard -> Account & Settings ->',
    '# Developer Controls -> API Keys -> Generate Key.',
    '#',
    '# THIS FILE IS GIT-IGNORED. Never commit it, and never paste the secret',
    '# into a chat, issue or screenshot.',
    '#',
    '# The secret is shown by Razorpay exactly ONCE at generation time.',
    '',
    'RAZORPAY_KEY_ID=' + existing.RAZORPAY_KEY_ID,
    'RAZORPAY_KEY_SECRET=' + existing.RAZORPAY_KEY_SECRET,
    '',
    '# Optional: webhook signing secret, from Dashboard -> Webhooks.',
    'RAZORPAY_WEBHOOK_SECRET=' + (existing.RAZORPAY_WEBHOOK_SECRET || ''),
    '',
    '# Local port.',
    'PORT=' + (existing.PORT || '3000'),
    '',
    '# Browsers allowed to call this API. Lock this down in production:',
    '#   ALLOWED_ORIGINS=https://amplaytro.github.io',
    'ALLOWED_ORIGINS=' + (existing.ALLOWED_ORIGINS || '*'),
    ''
  ].join('\n');

  fs.writeFileSync(ENV_FILE, order, { encoding: 'utf8' });

  const mode = keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST';
  console.log('\n  Written to .env (git-ignored).');
  console.log(`    key id  ${keyId.slice(0, 8)}…  (${mode} mode)`);
  console.log(`    secret  ${'*'.repeat(12)}  (${secret.length} chars, not shown)`);
  console.log('\n  Next:  node key-check.js      verify the pair');
  console.log('         node server/index.js   start the site + API\n');
};

prompt();