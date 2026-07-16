/**
 * websdk-adapter.js
 * ------------------------------------------------------------------
 * Same public shape as the Classic page's js/analytics.js —
 * updateConsent / trackPageView / trackEvent / getVisitorId / getState /
 * debug — so js/websdk-app.js and the shared console markup can stay
 * nearly identical to the Classic page. Everything inside is driven by
 * real alloy() commands (configure / setConsent / sendEvent / getIdentity)
 * using Adobe's actual documented consent standard and XDM event shapes.
 * ------------------------------------------------------------------
 */

const WebSDKAnalytics = (() => {
  const state = {
    consent: null,
    configured: false,
    loadMode: null, // 'tagProperty' | 'real' | 'shim'
    identity: null,
    eventCount: 0,
    ready: false,
    pendingConsent: null,
  };

  function log(status, message, detail) {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    document.dispatchEvent(new CustomEvent('analytics:log', {
      detail: { time, status, message, detail: detail || '' }
    }));
    const prefix = status === 'fired' ? '✅' : status === 'blocked' ? '⛔' : 'ℹ️';
    console.log(`${prefix} [WebSDKAnalytics] ${message}`, detail || '');
  }

  function alloy(...args) {
    return window[WEBSDK_CONFIG.instanceName](...args);
  }

  /**
   * Builds the real Adobe consent standard payload for alloy's
   * "setConsent" command. `collect` is Web SDK's primary data-collection
   * gate; the marketing.preferences.* fields are the closest analog to
   * ECID/VisitorAPI's "personalization" consent.
   */
  function buildConsentPayload(consent) {
    const collectVal = consent.analytics ? 'y' : 'n';
    const marketingVal = consent.personalization ? 'y' : 'n';
    return {
      consent: [{
        standard: 'Adobe',
        version: '2.0',
        value: {
          collect: { val: collectVal },
          marketing: {
            preferences: {
              emailPersonalized: marketingVal,
              pushPersonalized: marketingVal,
              inAppPersonalized: marketingVal,
              smsPersonalized: marketingVal,
              sharePersonalized: marketingVal,
              advertisingPersonalized: marketingVal,
            },
          },
          metadata: { time: new Date().toISOString() },
        },
      }],
    };
  }

  function configure() {
    if (state.configured) return;

    if (state.loadMode === 'tagProperty') {
      // The Data Collection UI property's Web SDK extension already called
      // configure() with its own Datastream settings when it loaded — call
      // it again here and we'd either get a harmless no-op or a conflicting
      // second configuration, depending on the extension version. Skip it.
      state.configured = true;
      log('info', 'Skipping our own configure()', 'Tag Property\'s Web SDK extension already configured alloy');
      if (state.pendingConsent) {
        applyConsent(state.pendingConsent);
        state.pendingConsent = null;
      }
      return;
    }

    if (!WEBSDK_CONFIG.edgeConfigId) {
      log('blocked', 'Cannot configure alloy', 'WEBSDK_CONFIG.edgeConfigId is empty in js/websdk-config.js');
    }
    alloy('configure', {
      edgeConfigId: WEBSDK_CONFIG.edgeConfigId,
      orgId: WEBSDK_CONFIG.orgId,
      debugEnabled: true,
    }).then(() => {
      state.configured = true;
      log('info', 'alloy("configure", ...) resolved', `edgeConfigId="${WEBSDK_CONFIG.edgeConfigId || '(empty)'}"`);
      if (state.pendingConsent) {
        applyConsent(state.pendingConsent);
        state.pendingConsent = null;
      }
    }).catch((err) => {
      log('blocked', 'alloy("configure", ...) rejected', String(err && err.message || err));
    });
  }

  function applyConsent(consent) {
    if (!state.configured) {
      state.pendingConsent = consent;
      log('info', 'alloy not configured yet', 'Consent choice queued, will apply once configure() resolves');
      return;
    }
    const payload = buildConsentPayload(consent);
    alloy('setConsent', payload).then(() => {
      state.consent = consent;
      log('info', 'alloy("setConsent", ...) resolved', `collect=${payload.consent[0].value.collect.val}, marketing=${payload.consent[0].value.marketing.preferences.emailPersonalized}`);
    }).catch((err) => {
      log('blocked', 'alloy("setConsent", ...) rejected', String(err && err.message || err));
    });
  }

  function updateConsent(consent) {
    state.consent = consent;
    applyConsent(consent);
  }

  function trackPageView(pageName) {
    if (!state.consent?.analytics) {
      log('blocked', `Page view blocked: "${pageName}"`, 'Reason: collect consent is "n" — sendEvent was not called');
      return;
    }
    state.eventCount += 1;
    alloy('sendEvent', {
      xdm: {
        eventType: 'web.webpagedetails.pageViews',
        web: {
          webPageDetails: { name: pageName, URL: window.location.href },
        },
      },
    }).then((result) => {
      log('fired', `Page view: "${pageName}"`, `sendEvent #${state.eventCount} resolved — ${JSON.stringify(result?.destinations ? { destinations: result.destinations.length } : result || {})}`);
    }).catch((err) => {
      log('blocked', `sendEvent threw for "${pageName}"`, String(err && err.message || err));
    });
  }

  /**
   * meta for commerce events: { id, name, price, quantity }
   * Uses the real XDM Commerce schema shape Adobe's docs use for
   * "add to cart" — this is standard practice, not demo-only shorthand.
   */
  function trackEvent(eventName, linkName, meta = {}) {
    if (!state.consent?.analytics) {
      log('blocked', `Event blocked: "${eventName}"`, 'Reason: collect consent is "n" — sendEvent was not called');
      return;
    }
    state.eventCount += 1;

    let xdm;
    if (eventName === 'scAdd') {
      xdm = {
        eventType: 'commerce.productListAdds',
        commerce: { productListAdds: { value: 1 } },
        productListItems: [{
          SKU: meta.id || '',
          name: meta.name || linkName,
          priceTotal: meta.price ? Number(String(meta.price).replace(/[^0-9.]/g, '')) : undefined,
          quantity: 1,
        }],
      };
    } else {
      xdm = {
        eventType: 'web.webinteraction.linkClicks',
        web: { webInteraction: { name: linkName, type: 'other', linkClicks: { value: 1 } } },
      };
    }

    alloy('sendEvent', { xdm }).then((result) => {
      log('fired', `Event: "${eventName}" (${linkName})`, `sendEvent #${state.eventCount} resolved — eventType="${xdm.eventType}"`);
    }).catch((err) => {
      log('blocked', `sendEvent threw for "${eventName}"`, String(err && err.message || err));
    });
  }

  function getVisitorId(callback) {
    if (!state.consent?.personalization) {
      log('blocked', 'Identity request blocked', 'Reason: marketing/personalization consent is "n"');
      if (typeof callback === 'function') callback(null);
      return;
    }
    if (state.identity) {
      log('fired', 'ECID retrieved (cached)', state.identity);
      if (typeof callback === 'function') callback(state.identity);
      return;
    }
    alloy('getIdentity', { namespaces: ['ECID'] }).then((result) => {
      const ecid = result?.identity?.ECID || null;
      state.identity = ecid;
      log('fired', 'ECID retrieved from real Edge Network', ecid);
      if (typeof callback === 'function') callback(ecid);
    }).catch((err) => {
      log('blocked', 'alloy("getIdentity", ...) rejected', String(err && err.message || err));
      if (typeof callback === 'function') callback(null);
    });
  }

  function getState() {
    return {
      consent: { ...state.consent },
      configured: state.configured,
      usingRealSDK: state.loadMode === 'real' || state.loadMode === 'tagProperty',
      loadMode: state.loadMode,
      identity: state.identity,
      eventCount: state.eventCount,
      edgeConfigId: WEBSDK_CONFIG.edgeConfigId,
      orgId: WEBSDK_CONFIG.orgId,
      tagPropertyUrl: WEBSDK_CONFIG.tagPropertyUrl,
    };
  }

  const debug = {
    setConsent: (consent) => applyConsent(consent),
    getIdentity: () => getVisitorId((id) => log('info', 'debug getIdentity() result', id || 'null')),
    sendTestEvent: () => trackEvent('debugPing', 'debug:ping'),
  };

  initWebSDK((err, mode) => {
    state.ready = true;
    state.loadMode = mode;
    if (err) {
      log('blocked', `Failed to load alloy (${mode})`, String(err.message || err));
    } else {
      const source = mode === 'tagProperty' ? WEBSDK_CONFIG.tagPropertyUrl
        : mode === 'real' ? WEBSDK_CONFIG.alloyScriptUrl
        : 'WEBSDK_CONFIG.useRealWebSDK is false and no tagPropertyUrl set';
      log('info', `alloy loaded via ${mode}`, source);
    }
    configure();
  });

  return { updateConsent, trackPageView, trackEvent, getVisitorId, getState, debug };
})();
