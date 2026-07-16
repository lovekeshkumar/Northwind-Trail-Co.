/**
 * adobe-config.js
 * ------------------------------------------------------------------
 * Values for the Version 5 demo.
 * ------------------------------------------------------------------
 */

const ADOBE_CONFIG = {
  rsid: 'lscslovekesh.test',
  trackingServer: 'cardga0.sc.omtrdc.net',
  orgId: '69AA402551915FB10A490D4D@AdobeOrg',

  // Adobe Data Collection UI > Tags > (your property) > Environments >
  // pick environment > "Install" > copy the embed <script> src.
  // This ONE script delivers AppMeasurement + ECID + Opt-In, all
  // configured via extensions/rules in the Adobe UI — set this and the
  // lines below (appMeasurementUrl/visitorApiUrl) are ignored.
  tagPropertyUrl: '',

  // Legacy fallback, used only when tagPropertyUrl is empty.
  appMeasurementUrl: 'vendor/adobe/AppMeasurement.js',
  visitorApiUrl: 'vendor/adobe/VisitorAPI.js',

  optInCategories: {
    analytics: ['aa'],
    ecid: ['ecid'],
  },
};
