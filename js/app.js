/**
 * app.js
 * ------------------------------------------------------------------
 * The storefront, newsletter form, and demo console UI.
 * ------------------------------------------------------------------
 */

const PRODUCTS = [
  { id: 'p1', name: 'Ridgeline 40L Pack',   price: '$189', color: '#2F6F5E', desc: 'Weatherproof multi-day pack with a load-shifting frame.' },
  { id: 'p2', name: 'Alder Merino Base',    price: '$64',  color: '#C0654F', desc: 'Odor-resistant layer for cold starts and long days.' },
  { id: 'p3', name: 'Basecamp Titanium Mug',price: '$28',  color: '#E2A33B', desc: 'Boils fast, packs flat, outlives the trip.' },
  { id: 'p4', name: 'Switchback Trekking Poles', price: '$74', color: '#234F43', desc: 'Carbon shafts, cork grips, collapses to 15in.' },
];

function getAdobeAnalytics() {
  return typeof AdobeAnalytics !== 'undefined' ? AdobeAnalytics : null;
}

function getConsentManager() {
  return typeof ConsentManager !== 'undefined' ? ConsentManager : null;
}

function registerNorthwindApi() {
  window.Northwind = window.Northwind || {};
  window.Northwind.consent = {
    acceptAll: () => getConsentManager()?.setConsent?.({ necessary: true, analytics: true, personalization: true }),
    rejectAll: () => getConsentManager()?.setConsent?.({ necessary: true, analytics: false, personalization: false }),
    acceptAnalyticsOnly: () => getConsentManager()?.setConsent?.({ necessary: true, analytics: true, personalization: false }),
    acceptECIDOnly: () => getConsentManager()?.setConsent?.({ necessary: true, analytics: false, personalization: true }),
    openPreferences: () => getConsentManager()?.openPreferencesModal?.(),
    get: () => getConsentManager()?.getConsent?.(),
  };
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
      getAdobeAnalytics()?.trackEvent('scAdd', `add-to-cart:${product.id}`, {
        eVar1: product.name,
        prop1: product.price,
      });
    });
  });
}

function bindNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  const feedback = document.getElementById('newsletterFeedback');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    getAdobeAnalytics()?.trackEvent('newsletterSubmit', 'newsletter:submit');

    getAdobeAnalytics()?.getVisitorId((visitorId) => {
      if (visitorId) {
        feedback.textContent = `Signed up — linked to visitor ${visitorId}.`;
        feedback.className = 'form-feedback mt-3 is-success';
      } else {
        feedback.textContent = 'Signed up — no ECID attached (consent not granted).';
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
      const api = getAdobeAnalytics();
      switch (btn.dataset.optinCmd) {
        case 'approve-aa':   api?.debug.approve(['aa']); break;
        case 'deny-aa':      api?.debug.deny(['aa']); break;
        case 'approve-ecid': api?.debug.approve(['ecid']); break;
        case 'deny-ecid':    api?.debug.deny(['ecid']); break;
        case 'complete':     api?.debug.complete(); break;
        case 'fetch':        api?.debug.fetchPermissions(); break;
      }
      refreshStatusChips();
    });
  });

  function refreshStatusChips() {
    const api = getAdobeAnalytics();
    if (!api) {
      statusVisitorId.innerHTML = `MCID: <strong>none</strong>`;
      statusMode.innerHTML = `Runtime: <strong>loading</strong>`;
      statusAnalytics.innerHTML = `Analytics consent <strong>—</strong>`;
      statusPersonalization.innerHTML = `ECID consent <strong>—</strong>`;
      return;
    }

    const {
      visitorId,
      appMeasurementLoaded,
      visitorApiLoaded,
      appMeasurementActive,
      visitorApiActive,
      runtimeReady,
      loadMode,
      lastBeaconCount,
      consent,
      optInPermissions,
    } = api.getState();

    const liveAnalytics = typeof optInPermissions?.aa === 'boolean' ? !!optInPermissions.aa : !!consent?.analytics;
    const liveECID = typeof optInPermissions?.ecid === 'boolean' ? !!optInPermissions.ecid : !!consent?.personalization;

    statusVisitorId.innerHTML = `MCID: <strong>${visitorId || 'none'}</strong>`;
    statusMode.innerHTML = `Runtime: <strong>${runtimeReady ? (loadMode === 'tagProperty' ? 'Tag Property' : 'legacy files') : 'waiting...'}</strong>`;
    statusAnalytics.innerHTML = `Analytics consent <strong>${liveAnalytics ? 'ON' : 'OFF'}</strong>`;
    statusPersonalization.innerHTML = `ECID consent <strong>${liveECID ? 'ON' : 'OFF'}</strong>`;
    statusNecessary.innerHTML = `Necessary <strong>ON</strong>`;
    consentSummary.innerHTML = `<span class="dot dot-live"></span> ${visitorApiLoaded ? 'VisitorAPI' : 'VisitorAPI?'} · ${appMeasurementLoaded ? 'AppMeasurement' : 'AppMeasurement?'}`;
    consoleEl.dataset.beaconCount = String(lastBeaconCount || 0);
  }

  function setOpen(open) {
    consoleEl.classList.toggle('is-open', open);
    toggleBtn.setAttribute('aria-expanded', String(open));
  }

  toggleBtn.addEventListener('click', () => {
    setOpen(!consoleEl.classList.contains('is-open'));
  });

  document.querySelectorAll('[data-open-console]').forEach((el) => {
    el.addEventListener('click', () => setOpen(true));
  });

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
    const source = detail.source || 'ui';

    getAdobeAnalytics()?.updateConsent(consent, source);
    refreshStatusChips();

    const summaryParts = [
      'Necessary',
      consent.analytics ? 'Analytics' : null,
      consent.personalization ? 'ECID' : null,
    ].filter(Boolean);
    consentSummary.innerHTML = `<span class="dot dot-live"></span> ${summaryParts.join(' · ')}`;

    if (consent.analytics && source !== 'bootstrap') {
      getAdobeAnalytics()?.trackPageView('Home');
    }

    refreshStatusChips();
  });

  registerNorthwindApi();
  refreshStatusChips();
}

document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  bindNewsletterForm();
  bindConsole();

  // Attempt a page view immediately. If consent is denied, it will be blocked.
  getAdobeAnalytics()?.trackPageView('Home');
});
