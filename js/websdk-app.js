/**
 * websdk-app.js
 * ------------------------------------------------------------------
 * Same storefront + console pattern as the Classic page's app.js,
 * wired to WebSDKAnalytics instead of AdobeAnalytics.
 * ------------------------------------------------------------------
 */

const PRODUCTS = [
  { id: 'p1', name: 'Ridgeline 40L Pack',   price: '$189', color: '#2F6F5E', desc: 'Weatherproof multi-day pack with a load-shifting frame.' },
  { id: 'p2', name: 'Alder Merino Base',    price: '$64',  color: '#C0654F', desc: 'Odor-resistant layer for cold starts and long days.' },
  { id: 'p3', name: 'Basecamp Titanium Mug',price: '$28',  color: '#E2A33B', desc: 'Boils fast, packs flat, outlives the trip.' },
  { id: 'p4', name: 'Switchback Trekking Poles', price: '$74', color: '#234F43', desc: 'Carbon shafts, cork grips, collapses to 15in.' },
];

function getWebSDKAnalytics() {
  return typeof WebSDKAnalytics !== 'undefined' ? WebSDKAnalytics : null;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = PRODUCTS.map((p) => `
    <div class="col-sm-6 col-lg-3">
      <div class="product-card">
        <div class="product-swatch" style="background:${p.color}">${p.id.toUpperCase()}</div>
        <p class="product-name">${p.name}</p>
        <p class="product-desc">${p.desc}</p>
        <div class="product-footer">
          <span class="product-price">${p.price}</span>
          <button class="btn btn-brand btn-sm" data-add-to-cart="${p.id}">Add to cart</button>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = PRODUCTS.find((p) => p.id === btn.dataset.addToCart);
      getWebSDKAnalytics()?.trackEvent('scAdd', `add-to-cart:${product.id}`, {
        id: product.id,
        name: product.name,
        price: product.price,
      });
    });
  });
}

function bindNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  const feedback = document.getElementById('newsletterFeedback');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    getWebSDKAnalytics()?.trackEvent('newsletterSubmit', 'newsletter:submit');

    getWebSDKAnalytics()?.getVisitorId((ecid) => {
      if (ecid) {
        feedback.textContent = `Signed up — linked to ECID ${ecid}.`;
        feedback.className = 'form-feedback mt-3 is-success';
      } else {
        feedback.textContent = 'Signed up — no ECID attached (marketing consent not granted).';
        feedback.className = 'form-feedback mt-3 is-blocked';
      }
    });

    form.reset();
  });
}

function bindConsole() {
  const consoleEl = document.getElementById('analyticsConsole');
  const toggleBtn = document.getElementById('consoleToggle');
  const logEl = document.getElementById('consoleLog');
  const consentSummary = document.getElementById('consentSummary');
  const statusNecessary = document.getElementById('statusNecessary');
  const statusAnalytics = document.getElementById('statusAnalytics');
  const statusPersonalization = document.getElementById('statusPersonalization');
  const statusVisitorId = document.getElementById('statusVisitorId');
  const statusMode = document.getElementById('statusMode');

  document.querySelectorAll('[data-optin-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const api = getWebSDKAnalytics();
      switch (btn.dataset.optinCmd) {
        case 'approve-aa':   api?.debug.setConsent({ necessary: true, analytics: true, personalization: api.getState().consent?.personalization }); break;
        case 'deny-aa':      api?.debug.setConsent({ necessary: true, analytics: false, personalization: api.getState().consent?.personalization }); break;
        case 'approve-ecid': api?.debug.setConsent({ necessary: true, analytics: api.getState().consent?.analytics, personalization: true }); break;
        case 'deny-ecid':    api?.debug.setConsent({ necessary: true, analytics: api.getState().consent?.analytics, personalization: false }); break;
        case 'complete':     api?.debug.sendTestEvent(); break;
        case 'fetch':        api?.debug.getIdentity(); break;
      }
      refreshStatusChips();
    });
  });

  function refreshStatusChips() {
    const api = getWebSDKAnalytics();
    if (!api) {
      statusVisitorId.innerHTML = `ECID: <strong>none</strong>`;
      statusMode.innerHTML = `Runtime: <strong>loading</strong>`;
      statusAnalytics.innerHTML = `Collect consent <strong>—</strong>`;
      statusPersonalization.innerHTML = `Marketing consent <strong>—</strong>`;
      return;
    }

    const { consent, configured, usingRealSDK, identity, eventCount } = api.getState();

    statusVisitorId.innerHTML = `ECID: <strong>${identity || 'none'}</strong>`;
    statusMode.innerHTML = `Mode: <strong>${usingRealSDK ? 'real alloy.js' : 'offline shim'}</strong>`;
    statusAnalytics.innerHTML = `Collect consent <strong>${consent?.analytics ? 'ON' : 'OFF'}</strong>`;
    statusPersonalization.innerHTML = `Marketing consent <strong>${consent?.personalization ? 'ON' : 'OFF'}</strong>`;
    statusNecessary.innerHTML = `Necessary <strong>ON</strong>`;
    consentSummary.innerHTML = `<span class="dot dot-live"></span> ${configured ? 'alloy configured' : 'alloy configuring…'} · ${eventCount} event(s) sent`;
  }

  function setOpen(open) {
    consoleEl.classList.toggle('is-open', open);
    toggleBtn.setAttribute('aria-expanded', String(open));
  }

  toggleBtn.addEventListener('click', () => setOpen(!consoleEl.classList.contains('is-open')));
  document.querySelectorAll('[data-open-console]').forEach((el) => el.addEventListener('click', () => setOpen(true)));

  document.addEventListener('analytics:log', (e) => {
    const { time, status, message, detail } = e.detail;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-status ${status}">${status.toUpperCase()}</span>
      <span class="log-message">${message}${detail ? ` <span class="log-detail">— ${detail}</span>` : ''}</span>
    `;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  });

  document.addEventListener('consent:updated', (e) => {
    const detail = e.detail || {};
    const consent = detail.consent || detail;

    getWebSDKAnalytics()?.updateConsent(consent);
    refreshStatusChips();

    const summaryParts = ['Necessary', consent.analytics ? 'Collect' : null, consent.personalization ? 'Marketing' : null].filter(Boolean);
    consentSummary.innerHTML = `<span class="dot dot-live"></span> ${summaryParts.join(' · ')}`;

    if (consent.analytics) {
      getWebSDKAnalytics()?.trackPageView('Home');
    }

    refreshStatusChips();
  });

  refreshStatusChips();
}

document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  bindNewsletterForm();
  bindConsole();
});
