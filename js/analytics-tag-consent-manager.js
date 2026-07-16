/**
 * analytics-tag-consent-manager.js
 * ------------------------------------------------------------------
 * Same as consent-manager.js (Classic page), used on analytics-tag.html
 * with its own isolated storage key (nt_consent_analyticstag_v1).
 * ------------------------------------------------------------------
 */

const ConsentManager = (() => {
  const STORAGE_KEY = 'nt_consent_analyticstag_v1';
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
    window.__northwindStoredConsent = record;
    window.__northwindConsentState = { ...record, committed: true };
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

  function showBanner() {
    els.banner.hidden = false;
  }

  function hideBanner() {
    els.banner.hidden = true;
  }

  function syncTogglesFromConsent(consent) {
    els.consentAnalytics.checked = !!consent.analytics;
    els.consentPersonalization.checked = !!consent.personalization;
  }

  function consentFromAdobeRuntime() {
    const optIn = window.adobe?.optIn;
    if (optIn && typeof optIn.permissions === 'function' && typeof optIn.isApproved === 'function') {
      try {
        const permissions = optIn.permissions() || {};
        return {
          necessary: true,
          analytics: !!permissions.aa || !!optIn.isApproved('aa'),
          personalization: !!permissions.ecid || !!optIn.isApproved('ecid'),
          version: CONSENT_VERSION,
          timestamp: new Date().toISOString(),
        };
      } catch {
        // fall through to localStorage
      }
    }

    return readStoredConsent() || defaultConsent;
  }

  function openPreferencesModal() {
    const current = consentFromAdobeRuntime();
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
    els.btnManagePrefs.addEventListener('click', () => {
      hideBanner();
      openPreferencesModal();
    });
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
