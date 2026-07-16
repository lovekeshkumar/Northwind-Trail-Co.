/**
 * websdk-consent-manager.js
 * ------------------------------------------------------------------
 * Same responsibilities and event contract as the Classic page's
 * consent-manager.js (broadcasts "consent:updated" with {consent,
 * source}), but deliberately uses its OWN storage key so the two demo
 * pages don't share consent state — each vendor implementation manages
 * its own consent independently, same as they would in production if
 * you ran Classic and Web SDK side by side during a migration.
 * ------------------------------------------------------------------
 */

const ConsentManager = (() => {
  const STORAGE_KEY = 'nt_consent_websdk_v1';
  const CONSENT_VERSION = 1;

  const defaultConsent = {
    necessary: true,
    analytics: false,
    personalization: false,
    version: CONSENT_VERSION,
    timestamp: null,
  };

  function readStoredConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== CONSENT_VERSION) return null;
      return {
        necessary: true,
        analytics: !!parsed.analytics,
        personalization: !!parsed.personalization,
        version: CONSENT_VERSION,
        timestamp: parsed.timestamp || null,
      };
    } catch {
      return null;
    }
  }

  function writeConsent(consent) {
    const record = {
      necessary: true,
      analytics: !!consent.analytics,
      personalization: !!consent.personalization,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return record;
  }

  function broadcast(consent, source = 'ui') {
    document.dispatchEvent(new CustomEvent('consent:updated', {
      detail: { consent, source }
    }));
  }

  let els = {};

  function cacheElements() {
    els = {
      banner: document.getElementById('consentBanner'),
      btnAcceptAll: document.getElementById('btnAcceptAll'),
      btnRejectAll: document.getElementById('btnRejectAll'),
      btnManagePrefs: document.getElementById('btnManagePrefs'),
      btnRejectAllModal: document.getElementById('btnRejectAllModal'),
      btnSavePrefs: document.getElementById('btnSavePrefs'),
      consentAnalytics: document.getElementById('consentAnalytics'),
      consentPersonalization: document.getElementById('consentPersonalization'),
      openPreferencesBtn: document.getElementById('openPreferencesBtn'),
      openPreferencesBtnFooter: document.getElementById('openPreferencesBtnFooter'),
      preferencesModalEl: document.getElementById('preferencesModal'),
    };
  }

  function showBanner() { els.banner.hidden = false; }
  function hideBanner() { els.banner.hidden = true; }

  function syncTogglesFromConsent(consent) {
    els.consentAnalytics.checked = !!consent.analytics;
    els.consentPersonalization.checked = !!consent.personalization;
  }

  function openPreferencesModal() {
    const current = readStoredConsent() || defaultConsent;
    syncTogglesFromConsent(current);
    const modal = bootstrap.Modal.getOrCreateInstance(els.preferencesModalEl);
    modal.show();
  }

  function applyAndPersist(consent, options = {}) {
    const record = writeConsent(consent);
    hideBanner();
    if (options.broadcast !== false) {
      broadcast(record, options.source || 'ui');
    }
    return record;
  }

  function acceptAll() {
    applyAndPersist({ necessary: true, analytics: true, personalization: true }, { source: 'ui' });
  }

  function rejectAll() {
    applyAndPersist({ necessary: true, analytics: false, personalization: false }, { source: 'ui' });
  }

  function saveFromModal() {
    applyAndPersist({
      necessary: true,
      analytics: els.consentAnalytics.checked,
      personalization: els.consentPersonalization.checked,
    }, { source: 'ui' });
  }

  function bindEvents() {
    els.btnAcceptAll.addEventListener('click', acceptAll);
    els.btnRejectAll.addEventListener('click', rejectAll);
    els.btnRejectAllModal.addEventListener('click', rejectAll);
    els.btnManagePrefs.addEventListener('click', () => { hideBanner(); openPreferencesModal(); });
    els.btnSavePrefs.addEventListener('click', saveFromModal);
    els.openPreferencesBtn.addEventListener('click', openPreferencesModal);
    els.openPreferencesBtnFooter.addEventListener('click', openPreferencesModal);
  }

  function init() {
    cacheElements();
    bindEvents();

    const stored = readStoredConsent();
    if (stored) {
      broadcast(stored, 'bootstrap');
    } else {
      broadcast(defaultConsent, 'bootstrap');
      showBanner();
    }
  }

  return {
    init,
    openPreferencesModal,
    getConsent: () => readStoredConsent() || defaultConsent,
    setConsent: (consent, options = {}) => applyAndPersist(consent, options),
  };
})();

document.addEventListener('DOMContentLoaded', ConsentManager.init);
