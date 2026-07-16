/**
 * analytics-tag-preinit.js
 * ------------------------------------------------------------------
 * Same as adobe-preinit.js (Classic page), used on analytics-tag.html
 * with its own isolated storage key so this page's consent state is
 * independent from the Classic and Web SDK pages'.
 * ------------------------------------------------------------------
 */

(() => {
  const STORAGE_KEY = 'nt_consent_analyticstag_v1';
  const CONSENT_VERSION = 1;

  const categories = { ANALYTICS: 'aa', ECID: 'ecid' };

  function normalizeConsent(consent) {
    return {
      necessary: true,
      analytics: !!consent?.analytics,
      personalization: !!consent?.personalization,
      version: CONSENT_VERSION,
      timestamp: consent?.timestamp || null,
    };
  }

  function readStoredConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalizeConsent({ analytics: false, personalization: false });
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== CONSENT_VERSION) {
        return normalizeConsent({ analytics: false, personalization: false });
      }
      return normalizeConsent(parsed);
    } catch {
      return normalizeConsent({ analytics: false, personalization: false });
    }
  }

  const consentState = {
    ...readStoredConsent(),
    committed: false,
  };

  function snapshotPermissions() {
    return {
      aa: !!consentState.analytics,
      ecid: !!consentState.personalization,
    };
  }

  function snapshotConsent() {
    return normalizeConsent({
      analytics: consentState.analytics,
      personalization: consentState.personalization,
      timestamp: new Date().toISOString(),
    });
  }

  function writeConsent(consent) {
    const record = normalizeConsent(consent);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      // ignore private mode write failures
    }
    window.__northwindStoredConsent = record;
    window.__northwindConsentState = { ...record, committed: true };
    return record;
  }

  function categoriesFromInput(input) {
    if (Array.isArray(input)) return input.filter(Boolean);
    if (typeof input === 'string' && input) return [input];
    return [];
  }

  function setCategories(input, value) {
    categoriesFromInput(input).forEach((cat) => {
      if (cat === 'aa') consentState.analytics = value;
      if (cat === 'ecid') consentState.personalization = value;
    });
    consentState.committed = false;
    return snapshotConsent();
  }

  window.__northwindConsentState = { ...consentState };

  window.adobe = window.adobe || {};
  window.adobe.OptInCategories = window.adobe.OptInCategories || categories;

  const optIn = {
    Categories: window.adobe.OptInCategories,
    status: consentState.committed ? 'complete' : 'changed',
    isComplete: consentState.committed,
    approve(input) {
      setCategories(input, true);
      this.status = 'changed';
      this.isComplete = false;
      return true;
    },
    deny(input) {
      setCategories(input, false);
      this.status = 'changed';
      this.isComplete = false;
      return true;
    },
    approveAll() {
      return this.approve(['aa', 'ecid']);
    },
    denyAll() {
      return this.deny(['aa', 'ecid']);
    },
    complete() {
      const consent = writeConsent(snapshotConsent());
      consentState.committed = true;
      this.status = 'complete';
      this.isComplete = true;
      return consent;
    },
    isApproved(category) {
      if (Array.isArray(category)) {
        return category.every((cat) => !!snapshotPermissions()[cat]);
      }
      return !!snapshotPermissions()[category];
    },
    permissions() {
      return snapshotPermissions();
    },
    fetchPermissions(callback) {
      const perms = snapshotPermissions();
      if (typeof callback === 'function') callback(perms);
      return perms;
    },
    registerPlugin() { return true; },
    execute(command) {
      if (command && typeof command.callback === 'function') {
        command.callback({ consent: snapshotConsent(), permissions: snapshotPermissions() });
      }
      return true;
    },
    on() { return true; },
    off() { return true; },
    memoizeContent() { return true; },
  };

  window.adobe.optIn = optIn;
})();
