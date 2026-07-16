/**
 * analytics-tag-config.js
 * ------------------------------------------------------------------
 * Same shape as adobe-config.js (Classic page), but appMeasurementUrl/
 * visitorApiUrl are deliberately left blank — this page exists
 * specifically to demo the Tag Property path, so if tagPropertyUrl is
 * empty, js/adobe-loader.js has nothing to fall back to and
 * js/analytics-tag-adapter.js will log clear "not ready" diagnostics
 * instead of silently loading the legacy files (that's what
 * index.html is for).
 * ------------------------------------------------------------------
 */

const ADOBE_CONFIG = {
  rsid: 'lscslovekesh.test',
  trackingServer: 'cardga0.sc.omtrdc.net',
  orgId: '69AA402551915FB10A490D4D@AdobeOrg',

  // Adobe Data Collection UI > Tags > (your Adobe Analytics property) >
  // Environments > pick environment > "Install" > copy the embed <script>
  // src. Needs the Adobe Analytics extension (and ideally Experience
  // Cloud ID + Opt-In Service extensions) enabled on that property.
  tagPropertyUrl: 'https://assets.adobedtm.com/e9875dd51dbe/ff9a451f30ef/launch-3d2286d9fd39-development.min.js',

  // Deliberately blank on this page — see file header.
  appMeasurementUrl: '',
  visitorApiUrl: '',

  optInCategories: {
    analytics: ['aa'],
    ecid: ['ecid'],
  },
};
