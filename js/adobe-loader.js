/**
 * adobe-loader.js
 * ------------------------------------------------------------------
 * Decides how AppMeasurement/VisitorAPI actually get onto the page:
 *
 *   1. ADOBE_CONFIG.tagPropertyUrl set  -> inject that ONE embed script.
 *      This is a Data Collection UI ("Tags"/Launch) property with the
 *      Adobe Analytics + Experience Cloud ID + Opt-In Service extensions
 *      enabled. Everything — library delivery, s.account/trackingServer,
 *      and (usually) an automatic page-view rule — is configured in the
 *      Adobe UI, not here.
 *   2. Otherwise -> fall back to loading vendor/adobe/*.js directly,
 *      same as the legacy setup, so the demo still works without a
 *      Tags property hooked up yet.
 *
 * js/analytics.js doesn't need to know which path was taken — it already
 * lazily checks for window.s_gi / window.Visitor / window.adobe.optIn /
 * window._satellite on every call, which works fine whether those
 * appeared synchronously (legacy files) or asynchronously (tag property).
 * ------------------------------------------------------------------
 */

function injectScript(src, onload) {
  const el = document.createElement('script');
  el.src = src;
  el.async = true;
  el.onload = () => onload(null);
  el.onerror = () => onload(new Error(`Failed to load ${src}`));
  document.head.appendChild(el);
}

function injectScriptsInSequence(urls, done) {
  if (urls.length === 0) { done(null); return; }
  const [next, ...rest] = urls;
  injectScript(next, (err) => {
    if (err) { done(err); return; }
    injectScriptsInSequence(rest, done);
  });
}

function initAdobeLoader(onReady) {
  if (ADOBE_CONFIG.tagPropertyUrl) {
    injectScript(ADOBE_CONFIG.tagPropertyUrl, (err) => {
      onReady(err, 'tagProperty');
    });
    return;
  }

  const files = [ADOBE_CONFIG.visitorApiUrl, ADOBE_CONFIG.appMeasurementUrl].filter(Boolean);
  injectScriptsInSequence(files, (err) => {
    onReady(err, 'legacyFiles');
  });
}
