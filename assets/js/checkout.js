/* ==========================================================================
   VEDARA — Razorpay checkout
   Owns the [data-checkout] button (cart.js no longer handles it).

   Flow:
     1. POST /api/orders   server re-prices the cart and creates the order
     2. open Razorpay Checkout with the order id + public key id
     3. POST /api/verify   server checks the signature and capture status
     4. clear the cart and confirm

   The Razorpay key SECRET never reaches the browser.
   ========================================================================== */

/* Point this at wherever the API is hosted. Same-origin by default, which
   works when the Node server also serves the static files. Alternatively set
   <html data-api-base="https://api.example.com"> or window.VEDARA_API_BASE. */
const API_BASE = document.documentElement.dataset.apiBase || window.VEDARA_API_BASE || '';

/* No effect on Razorpay's behaviour — the key itself decides test vs live.
   This only controls a console note. */
const LOG_TEST_MODE = true;

const EMAIL_KEY = 'vedara.email';
let razorpayLoading = null;

/* --- helpers ------------------------------------------------------------- */
/* NB: `money` is deliberately not redeclared here. cart.js defines it at top
   level, and classic scripts share one global lexical scope — a second
   `const money` would be a SyntaxError that silently kills this whole file. */

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (razorpayLoading) return razorpayLoading;

  razorpayLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () =>
      window.Razorpay
        ? resolve(window.Razorpay)
        : reject(new Error('Razorpay failed to initialise.'));
    s.onerror = () => {
      razorpayLoading = null;
      reject(new Error('Could not reach Razorpay. Check your connection.'));
    };
    document.head.appendChild(s);
  });
  return razorpayLoading;
}

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* a non-JSON error page */
  }

  if (!res.ok) {
    const err = new Error(data.detail || data.error || `Request failed (${res.status})`);
    err.code = data.error;
    throw err;
  }
  return data;
}

/* Remember the address from the newsletter form so Razorpay can prefill it. */
function rememberEmail(value) {
  try {
    localStorage.setItem(EMAIL_KEY, value);
  } catch {}
}

function knownEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

/* --- confirmation panel -------------------------------------------------- */
function showConfirmation({ paymentId, total }) {
  const scrim = document.getElementById('scrim');
  const drawer = document.getElementById('cartDrawer');
  if (drawer) drawer.classList.remove('is-open');
  if (scrim) scrim.classList.remove('is-open');
  document.body.classList.remove('is-locked');

  const panel = document.createElement('div');
  panel.className = 'modal';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'confirmTitle');
  panel.innerHTML = `
    <div class="modal__card">
      <div class="modal__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <span class="eyebrow is-center">Order confirmed</span>
      <h2 id="confirmTitle">Thank you.</h2>
      <p>
        Your receipt is on its way by email, and your oils leave our kitchen
        within one working day.
      </p>
      <dl class="modal__facts">
        <div><dt>Amount paid</dt><dd>${money(total)}</dd></div>
        <div><dt>Payment reference</dt><dd class="mono">${paymentId || '—'}</dd></div>
      </dl>
      <button class="btn btn--block" type="button" data-modal-close>Continue shopping</button>
    </div>`;

  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add('is-open'));

  const close = () => {
    panel.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => panel.remove(), 320);
  };
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  panel.addEventListener('click', (e) => {
    if (e.target === panel || e.target.closest('[data-modal-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  panel.querySelector('[data-modal-close]').focus();
}

/* --- main flow ----------------------------------------------------------- */
async function beginCheckout() {
  if (!count()) {
    toast('Your basket is empty');
    return;
  }

  let order;
  try {
    order = await api('/api/orders', {
      method: 'POST',
      body: { lines: detailed().map(({ id, variant, qty }) => ({ id, variant, qty })) }
    });
  } catch (err) {
    if (err.code === 'payments_not_configured') {
      toast('Payments are not configured yet');
      return;
    }
    console.error('[vedara] order creation failed:', err);
    toast(err.message || 'Could not start the payment. Please try again.');
    return;
  }

  if (typeof closeCart === 'function') closeCart();

  let Razorpay;
  try {
    Razorpay = await loadRazorpayScript();
  } catch (err) {
    toast(err.message);
    return;
  }

  const checkout = new Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: 'Vedara',
    description: order.lines
      .map((l) => `${l.qty}x ${l.name}`)
      .join(', ')
      .slice(0, 80),
    image: new URL('assets/img/chandan.svg', location.href).href,
    order_id: order.orderId,
    prefill: { email: knownEmail() },
    notes: { site: 'vedara' },
    theme: { color: '#2E4034' },
    modal: {
      ondismiss: () => toast('Payment cancelled — your basket is safe'),
      escape: true
    },
    handler: async (response) => {
      try {
        const result = await api('/api/verify', {
          method: 'POST',
          body: {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          }
        });

        if (result.captured) {
          clearCart();
          showConfirmation({ paymentId: result.paymentId, total: order.total });
        } else {
          toast(`Payment status: ${result.status}`);
        }
      } catch (err) {
        console.error('[vedara] verification failed:', err);
        toast('We could not verify the payment. Contact us if you were charged.');
      }
    }
  });

  if (LOG_TEST_MODE) console.info('[vedara] Razorpay test mode — no real money moves.');
  checkout.open();
}

/* --- wiring -------------------------------------------------------------- */
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-checkout]')) return;
  e.preventDefault();
  beginCheckout();
});

/* Capture the newsletter email so Razorpay can prefill it. */
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!form.matches?.('[data-subscribe]')) return;
  const input = form.querySelector('input[type="email"]');
  if (input && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim())) {
    rememberEmail(input.value.trim());
  }
});