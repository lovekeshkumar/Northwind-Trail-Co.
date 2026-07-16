/**
 * analytics-tag-adapter.js
 * ------------------------------------------------------------------
 * Same as analytics.js (Classic page), used on analytics-tag.html.
 * The only functional difference is the isolated localStorage key
 * (nt_consent_analyticstag_v1) so this page's consent state never
 * mixes with the Classic or Web SDK pages'. Loading is still handled
 * by the shared js/adobe-loader.js — on this page, ADOBE_CONFIG has
 * appMeasurementUrl/visitorApiUrl left blank, so it only works once
 * ADOBE_CONFIG.tagPropertyUrl is filled in with a real Data Collection
 * UI (Tags/Launch) embed that has the Adobe Analytics extension enabled.
 * ------------------------------------------------------------------
 */

const AdobeAnalytics = (() => {
  const state = {
    consent: null,
    s: null,
    visitorInstance: null,
    visitorId: null,
    pageViewCount: 0,
    patchedComplete: false,
    suppressAdobeCompleteDispatch: false,
    loadMode: null, // 'tagProperty' | 'legacyFiles', set once initAdobeLoader() reports back
  };

  function log(status, message, detail) {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    document.dispatchEvent(new CustomEvent('analytics:log', {
      detail: { time, status, message, detail: detail || '' }
    }));
    const prefix = status === 'fired' ? '✅' : status === 'blocked' ? '⛔' : 'ℹ️';
    console.log(`${prefix} [AdobeAnalytics] ${message}`, detail || '');
  }

  function normalizeConsent(consent) {
    return {
      necessary: true,
      analytics: !!consent?.analytics,
      personalization: !!consent?.personalization,
      version: consent?.version ?? 1,
      timestamp: consent?.timestamp ?? null,
    };
  }

  function consentEquals(a, b) {
    return !!a && !!b &&
      !!a.necessary === !!b.necessary &&
      !!a.analytics === !!b.analytics &&
      !!a.personalization === !!b.personalization;
  }

  function categoriesFor(key) {
    const map = ADOBE_CONFIG.optInCategories || {
      analytics: ['aa'],
      ecid: ['ecid'],
    };
    return Array.isArray(map[key]) ? map[key].filter(Boolean) : [];
  }

  function getOptIn() {
    return window.adobe?.optIn || null;
  }

  function ensureOptInSurface() {
    const optIn = getOptIn();
    if (!optIn) return;

    const fallback = { ANALYTICS: 'aa', ECID: 'ecid' };
    if (!optIn.Categories) {
      try {
        Object.defineProperty(optIn, 'Categories', {
          configurable: true,
          enumerable: true,
          get() {
            return window.adobe?.OptInCategories || fallback;
          },
        });
      } catch {
        optIn.Categories = window.adobe?.OptInCategories || fallback;
      }
    }

    if (typeof optIn.permissions !== 'function') {
      optIn.permissions = () => ({
        aa: !!optIn.isApproved?.('aa'),
        ecid: !!optIn.isApproved?.('ecid'),
      });
    }
  }

  function currentConsentFromStorage() {
    try {
      const raw = localStorage.getItem('nt_consent_analyticstag_v1');
      if (!raw) return normalizeConsent({ analytics: false, personalization: false });
      return normalizeConsent(JSON.parse(raw));
    } catch {
      return normalizeConsent({ analytics: false, personalization: false });
    }
  }

  function currentConsentFromOptIn() {
    const optIn = getOptIn();
    if (!optIn || typeof optIn.isApproved !== 'function') return null;
    const analyticsCats = categoriesFor('analytics');
    const ecidCats = categoriesFor('ecid');
    return normalizeConsent({
      analytics: analyticsCats.length ? analyticsCats.every((c) => !!optIn.isApproved(c)) : false,
      personalization: ecidCats.length ? ecidCats.every((c) => !!optIn.isApproved(c)) : false,
      timestamp: new Date().toISOString(),
    });
  }

  function initializeRuntime() {
    if (!state.s && typeof window.s_gi === 'function') {
      try {
        const s = window.s_gi(ADOBE_CONFIG.rsid);
        if (s) {
          s.account = ADOBE_CONFIG.rsid;
          s.trackingServer = ADOBE_CONFIG.trackingServer;
          s.trackingServerSecure = ADOBE_CONFIG.trackingServer;
          state.s = s;
          window.s = s;
        }
      } catch (err) {
        log('blocked', 'Failed to initialize AppMeasurement object', err.message);
      }
    }

    if (!state.visitorInstance && window.Visitor && ADOBE_CONFIG.orgId) {
      try {
        state.visitorInstance = window.Visitor.getInstance(ADOBE_CONFIG.orgId, {
          trackingServer: ADOBE_CONFIG.trackingServer,
          trackingServerSecure: ADOBE_CONFIG.trackingServer,
        });
        if (state.s) state.s.visitor = state.visitorInstance;
      } catch (err) {
        log('blocked', 'Visitor.getInstance failed', err.message);
      }
    }

    if (state.visitorInstance && !state.visitorId && state.consent?.personalization) {
      try {
        state.visitorInstance.getMarketingCloudVisitorID((id) => {
          state.visitorId = id;
          log('info', 'Visitor ID retrieved from real ECID service', id);
        });
      } catch (err) {
        log('blocked', 'Visitor ID request failed', err.message);
      }
    }
  }

  function persistConsent(consent) {
    const record = normalizeConsent(consent);
    try {
      localStorage.setItem('nt_consent_analyticstag_v1', JSON.stringify(record));
    } catch {
      // ignore
    }
    window.__northwindStoredConsent = record;
    window.__northwindConsentState = { ...record, committed: true };
    return record;
  }

  function patchCompleteHook() {
    const optIn = getOptIn();
    if (!optIn || state.patchedComplete || typeof optIn.complete !== 'function') return;

    const originalComplete = optIn.complete.bind(optIn);
    optIn.complete = (...args) => {
      const result = originalComplete(...args);
      if (!state.suppressAdobeCompleteDispatch) {
        const consent = currentConsentFromOptIn() || currentConsentFromStorage();
        const record = persistConsent(consent);
        document.dispatchEvent(new CustomEvent('consent:updated', {
          detail: { consent: record, source: 'adobe' }
        }));
      }
      return result;
    };

    state.patchedComplete = true;
    log('info', 'Adobe optIn complete() hook installed', 'Manual browser-console complete() calls will persist consent');
  }

  function applyConsentToAdobe(consent) {
    const optIn = getOptIn();
    if (!optIn) {
      log('blocked', 'adobe.optIn not ready yet', 'VisitorAPI.js has not initialized the Opt-In Service');
      return false;
    }

    ensureOptInSurface();
    const desired = normalizeConsent(consent);
    const existing = currentConsentFromOptIn();
    if (existing && consentEquals(existing, desired)) return true;

    try {
      state.suppressAdobeCompleteDispatch = true;

      const analyticsCats = categoriesFor('analytics');
      const ecidCats = categoriesFor('ecid');

      if (desired.analytics) optIn.approve(analyticsCats);
      else optIn.deny(analyticsCats);

      if (desired.personalization) optIn.approve(ecidCats);
      else optIn.deny(ecidCats);

      if (typeof optIn.complete === 'function') {
        optIn.complete();
      }

      log('info', 'adobe.optIn.complete()', `Permissions committed — Analytics=${desired.analytics ? 'ON' : 'OFF'}, ECID=${desired.personalization ? 'ON' : 'OFF'}`);
      state.consent = desired;
      return true;
    } catch (err) {
      log('blocked', 'Failed to update adobe.optIn', err.message);
      return false;
    } finally {
      state.suppressAdobeCompleteDispatch = false;
    }
  }

  function updateConsent(consent, source = 'ui') {
    const normalized = normalizeConsent(consent);
    const changed = !consentEquals(state.consent, normalized);
    state.consent = normalized;

    initializeRuntime();
    ensureOptInSurface();
    patchCompleteHook();

    if (source !== 'adobe' && changed) {
      applyConsentToAdobe(normalized);
    }

    if (normalized.personalization) {
      initializeRuntime();
    } else {
      state.visitorId = null;
      if (state.s) state.s.visitor = null;
    }
  }

  function trackPageView(pageName) {
    initializeRuntime();
    if (!state.s) {
      log('blocked', `Page view blocked: "${pageName}"`, 'AppMeasurement is not ready');
      return;
    }
    if (!state.consent?.analytics) {
      log('blocked', `Page view blocked: "${pageName}"`, 'Reason: Analytics consent is missing');
      return;
    }

    state.pageViewCount += 1;
    state.s.pageName = pageName;
    state.s.events = '';
    const result = state.s.t();
    log('fired', `Page view: "${pageName}"`, `s.t() beacon #${state.pageViewCount} — ${result}`);
  }

  function trackEvent(eventName, linkName, meta = {}) {
    initializeRuntime();
    if (!state.s) {
      log('blocked', `Event blocked: "${eventName}"`, 'AppMeasurement is not ready');
      return;
    }
    if (!state.consent?.analytics) {
      log('blocked', `Event blocked: "${eventName}"`, 'Reason: Analytics consent is missing');
      return;
    }

    state.pageViewCount += 1;
    if (meta.eVar1) state.s.eVar1 = meta.eVar1;
    if (meta.prop1) state.s.prop1 = meta.prop1;
    if (meta.eVar2) state.s.eVar2 = meta.eVar2;
    if (meta.prop2) state.s.prop2 = meta.prop2;

    state.s.linkTrackEvents = eventName;
    state.s.linkTrackVars = 'events,eVar1,prop1,eVar2,prop2';
    state.s.events = eventName;

    // Adobe's documented pattern: pass the real element for a genuine
    // navigating link (s.tl(this,...)), or `true` for a custom, non-
    // navigating link click like this Add to Cart button. `null` falls
    // into neither case cleanly — some AppMeasurement builds treat it as
    // "wait to intercept navigation," which never happens here, so the
    // call returns without error but no beacon is actually sent.
    const result = state.s.tl(true, 'o', linkName);
    log('fired', `Event: "${eventName}" (${linkName})`, `s.tl() beacon #${state.pageViewCount} — ${result}`);
  }

  function getVisitorId(callback) {
    initializeRuntime();
    ensureOptInSurface();
    patchCompleteHook();

    if (!state.consent?.personalization) {
      log('blocked', 'Visitor ID request blocked', 'Reason: ECID consent is missing');
      if (typeof callback === 'function') callback(null);
      return;
    }

    if (state.visitorId) {
      log('fired', 'Visitor ID retrieved', state.visitorId);
      if (typeof callback === 'function') callback(state.visitorId);
      return;
    }

    if (state.visitorInstance && typeof state.visitorInstance.getMarketingCloudVisitorID === 'function') {
      try {
        state.visitorInstance.getMarketingCloudVisitorID((id) => {
          state.visitorId = id;
          log('fired', 'Visitor ID retrieved', id);
          if (typeof callback === 'function') callback(id);
        });
        return;
      } catch (err) {
        log('blocked', 'Visitor ID request failed', err.message);
      }
    }

    if (typeof callback === 'function') callback(null);
  }

  function getState() {
    initializeRuntime();
    const optIn = getOptIn();

    return {
      visitorId: state.visitorId,
      visitorApiLoaded: !!window.Visitor,
      appMeasurementLoaded: !!window.s_gi,
      visitorApiActive: !!state.consent?.personalization,
      appMeasurementActive: !!state.consent?.analytics,
      runtimeReady: !!(window.Visitor && window.s_gi),
      loadMode: state.loadMode,
      rsid: ADOBE_CONFIG.rsid,
      trackingServer: ADOBE_CONFIG.trackingServer,
      orgId: ADOBE_CONFIG.orgId,
      consent: { ...state.consent },
      optInReady: !!optIn,
      optInCategories: optIn?.Categories || null,
      optInPermissions: optIn?.permissions ? optIn.permissions() : null,
      lastBeaconCount: state.pageViewCount,
    };
  }

  function categoriesToArray(categories) {
    if (Array.isArray(categories)) return categories.filter(Boolean);
    if (typeof categories === 'string' && categories) return [categories];
    return [];
  }

  const debug = {
    approve(categories) {
      const optIn = getOptIn();
      if (optIn && typeof optIn.approve === 'function') {
        optIn.approve(categoriesToArray(categories));
        log('info', `adobe.optIn.approve(${JSON.stringify(categoriesToArray(categories))})`, 'permission staged');
      }
    },
    deny(categories) {
      const optIn = getOptIn();
      if (optIn && typeof optIn.deny === 'function') {
        optIn.deny(categoriesToArray(categories));
        log('info', `adobe.optIn.deny(${JSON.stringify(categoriesToArray(categories))})`, 'permission staged');
      }
    },
    complete() {
      const optIn = getOptIn();
      if (optIn && typeof optIn.complete === 'function') {
        optIn.complete();
      }
      patchCompleteHook();
      log('info', 'adobe.optIn.complete()', 'Permissions committed — consent is now persisted');
    },
    fetchPermissions() {
      const optIn = getOptIn();
      if (!optIn) {
        log('info', 'adobe.optIn.fetchPermissions()', 'Opt-In not ready yet');
        return;
      }
      try {
        if (typeof optIn.fetchPermissions === 'function') {
          optIn.fetchPermissions((perms) => {
            log('info', 'fetchPermissions() result', JSON.stringify(perms || {}));
          }, true);
        } else if (typeof optIn.permissions === 'function') {
          log('info', 'fetchPermissions() result', JSON.stringify(optIn.permissions() || {}));
        } else {
          log('info', 'fetchPermissions() result', '{}');
        }
      } catch (err) {
        log('blocked', 'fetchPermissions() failed', err.message);
      }
    },
    isApproved(category) {
      const optIn = getOptIn();
      return !!(optIn && typeof optIn.isApproved === 'function' && optIn.isApproved(category));
    },
  };

  // Bootstrap from current runtime.
  state.consent = currentConsentFromStorage();
  initializeRuntime();
  ensureOptInSurface();
  patchCompleteHook();

  if (typeof initAdobeLoader === 'function') {
    initAdobeLoader((err, mode) => {
      state.loadMode = mode;
      if (err) {
        log('blocked', `Failed to load Adobe library (${mode})`, String(err.message || err));
        return;
      }
      log('info', `Adobe library loaded via ${mode === 'tagProperty' ? 'Tag Property embed' : 'legacy vendor files'}`,
        mode === 'tagProperty' ? ADOBE_CONFIG.tagPropertyUrl : `${ADOBE_CONFIG.visitorApiUrl}, ${ADOBE_CONFIG.appMeasurementUrl}`);
      // Re-run bootstrap checks now that the library has actually loaded.
      initializeRuntime();
      ensureOptInSurface();
      patchCompleteHook();
      if (window._satellite) {
        log('info', '_satellite detected', 'Direct Call Rules are available if you want Launch rules to own event firing instead of direct s.tl() calls');
      }
    });
  }

  if (state.s) {
    log('info', 'AppMeasurement ready', `account="${state.s.account}", trackingServer="${state.s.trackingServer}"`);
  }
  if (window.Visitor) {
    log('info', 'VisitorAPI ready', 'Real Visitor library detected');
  }
  if (getOptIn()) {
    log('info', 'Real adobe.optIn detected', 'Using the Opt-In Service loaded with the page');
  }

  return {
    updateConsent,
    trackPageView,
    trackEvent,
    getVisitorId,
    getState,
    debug,
  };
})();
