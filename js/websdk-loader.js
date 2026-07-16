/**
 * websdk-loader.js
 * ------------------------------------------------------------------
 * Installs the alloy command-queue stub — the same pattern Adobe's own
 * docs have you paste into <head> — so calls like alloy("sendEvent", ...)
 * work immediately and get queued even before the real library finishes
 * loading. Then either loads the real alloy.js (open source, from a
 * public CDN) or, if WEBSDK_CONFIG.useRealWebSDK is false, installs a
 * local shim with the same command surface so the consent UX still runs
 * with zero network calls.
 * ------------------------------------------------------------------
 */

(function installAlloyStub(win, instanceName) {
  if (typeof win[instanceName] === 'function') return; // already installed

  const queue = [];
  const fn = function (...args) {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });
    });
  };
  fn.q = queue;
  win[instanceName] = fn;
})(window, WEBSDK_CONFIG.instanceName);

function loadRealAlloy(onReady) {
  const script = document.createElement('script');
  script.src = WEBSDK_CONFIG.alloyScriptUrl;
  script.async = true;
  script.onload = () => onReady(null);
  script.onerror = () => onReady(new Error(`Failed to load ${WEBSDK_CONFIG.alloyScriptUrl}`));
  document.head.appendChild(script);
}

function loadTagProperty(onReady) {
  const script = document.createElement('script');
  script.src = WEBSDK_CONFIG.tagPropertyUrl;
  script.async = true;
  script.onload = () => onReady(null);
  script.onerror = () => onReady(new Error(`Failed to load ${WEBSDK_CONFIG.tagPropertyUrl}`));
  document.head.appendChild(script);
}

/**
 * A minimal local stand-in for alloy() with the same command surface
 * (configure / setConsent / sendEvent), used only when neither a Tag
 * Property nor useRealWebSDK is configured. It resolves promises locally
 * instead of hitting the Edge Network, so the consent gating UX is fully
 * demoable offline.
 */
function installOfflineAlloyShim(win, instanceName) {
  const state = { consent: null, configured: false };

  win[instanceName] = function (command, options) {
    return new Promise((resolve) => {
      switch (command) {
        case 'configure':
          state.configured = true;
          resolve({ command, options });
          break;
        case 'setConsent':
          state.consent = options;
          resolve({ command, options });
          break;
        case 'sendEvent':
          if (!state.consent) {
            resolve({ command, blocked: true, reason: 'setConsent was never called' });
          } else {
            resolve({ command, options, blocked: false });
          }
          break;
        default:
          resolve({ command, options });
      }
    });
  };
  win[instanceName].q = [];
  win[instanceName].__offlineShim = true;
}

/**
 * onReady(err, mode) where mode is one of:
 *   'tagProperty' — a Data Collection UI Web SDK property embed was
 *                   loaded; it already called configure() itself with
 *                   the Datastream settings from its extension config.
 *   'real'        — real alloy.js loaded from the public CDN; our own
 *                   adapter still needs to call configure() itself.
 *   'shim'        — local offline stand-in; no network calls happen.
 */
function initWebSDK(onReady) {
  if (WEBSDK_CONFIG.tagPropertyUrl) {
    loadTagProperty((err) => onReady(err, 'tagProperty'));
  } else if (WEBSDK_CONFIG.useRealWebSDK) {
    loadRealAlloy((err) => onReady(err, 'real'));
  } else {
    installOfflineAlloyShim(window, WEBSDK_CONFIG.instanceName);
    onReady(null, 'shim');
  }
}
