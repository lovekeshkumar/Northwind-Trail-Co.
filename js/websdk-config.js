/**
 * websdk-config.js
 * ------------------------------------------------------------------
 * Fill this in with values from YOUR Adobe Experience Platform
 * Datastream (Data Collection UI > Datastreams). Unlike AppMeasurement/
 * VisitorAPI, alloy.js itself is open source — nothing here is a
 * license file, just the identifiers that tell alloy which Adobe
 * property to talk to.
 * ------------------------------------------------------------------
 */

const WEBSDK_CONFIG = {

  // Master switch for the CDN/offline fallback path (ignored if
  // tagPropertyUrl below is set — a Tag Property takes priority).
  useRealWebSDK: true,

  // Data Collection UI > Tags > (your Web SDK property) > Environments >
  // pick environment > "Install" > copy the embed <script> src. This ONE
  // script delivers alloy.js AND calls configure() with the Datastream
  // settings from the Web SDK extension's configuration in the Adobe UI —
  // when this is set, edgeConfigId/orgId/alloyScriptUrl below are ignored
  // and our own configure() call is skipped.
  tagPropertyUrl: 'https://assets.adobedtm.com/6a203c8a0ff8/5bc14ceeda0f/launch-6648016bb291-development.min.js',

  // Data Collection UI > Datastreams > (your stream) > "Edge Configuration ID"
  edgeConfigId: '',

  // Experience Cloud Org ID — same value as ADOBE_CONFIG.orgId on the Classic page.
  orgId: '',

  // The global variable name alloy.js installs. 'alloy' is the default
  // Adobe uses in all their docs/examples — only change this if your
  // org customized it (rare, but supported by the real stub loader).
  instanceName: 'alloy',

  // Real alloy.js, loaded from a public CDN. Swap this for a self-hosted
  // copy or your Launch/Tags embed URL if your org requires that instead.
  alloyScriptUrl: 'https://cdn.jsdelivr.net/npm/@adobe/alloy@2/dist/alloy.min.js',

  // Maps this demo's two consent toggles onto the real Adobe consent
  // standard's fields (alloy "setConsent" command). `collect` is Web
  // SDK's primary data-collection gate — the closest analog to
  // AppMeasurement's 'aa'. The marketing.preferences.* fields are the
  // closest analog to ECID/VisitorAPI's "personalization" concept.
  consentMapping: {
    analytics: ['collect'],
    personalization: ['marketing'],
  },
};
