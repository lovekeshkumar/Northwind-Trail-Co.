# Northwind Trail Co. — Adobe Analytics Consent Demo (Version 5.1)

Version 5.1 follows the architecture from your working Adobe sample and improves runtime/UI sync:

- `VisitorAPI.js` and `AppMeasurement.js` are loaded up front.
- Consent does **not** control whether the scripts exist.
- Consent controls whether Adobe may create ECID and send Analytics beacons.
- Tracking calls are attempted on page load and after consent changes so the demo can show both the blocked and allowed states.
- Manual browser-console `adobe.optIn.complete()` persists the final choice to `localStorage`, and the Privacy Choices modal reads the live Adobe runtime when it opens.

## What changed in Version 5.1

- Added `js/adobe-preinit.js` to provide a safe, denied-by-default `adobe.optIn` before the Adobe libraries run.
- Added `js/analytics.js` as a thin wrapper around the real Adobe runtime.
- Kept the storefront and consent UI, but made the analytics layer much smaller.
- Made consent broadcasts carry a `source` so UI and console changes can both be shown cleanly.
- Updated the console labels to use **ECID** instead of the old personalization wording.

## Expected behavior

- Page load attempts a page view immediately.
- If consent is denied, the call is blocked and no beacon fires.
- If Analytics is approved, the page view and link tracking can fire.
- If ECID is denied but Analytics is allowed, the beacon can fire without a MID.
- If both are approved, you get both the beacon and the MID.
- Manual browser-console changes followed by `adobe.optIn.complete()` persist for the next reload.

## Run it

```bash
cd northwind-v5-fixed
python3 -m http.server 8080
# open http://localhost:8080
```

## Console examples

```js
adobe.optIn.denyAll();
adobe.optIn.complete();

adobe.optIn.approve(['aa']);
adobe.optIn.complete();

adobe.optIn.approve(['ecid']);
adobe.optIn.complete();
```

## Fixed: Add to Cart / link events not sending a beacon

`js/analytics.js` was calling `state.s.tl(null, 'o', linkName)`. AppMeasurement's
`s.tl()` treats its first argument as either the real DOM element (for a
genuine navigating link — pass `this` inside the click handler) or `true`
(for a custom, non-navigating link click, which is what "Add to Cart"
actually is). `null` falls into neither case cleanly, so some builds fall
back to a "wait to intercept navigation" branch that never resolves —
the call returns without error (hence it still logged as "fired"), but no
beacon is actually built and sent. Changed to `state.s.tl(true, 'o', linkName)`,
which is the documented pattern for exactly this case. This is the single
`s.tl()` call site, shared by both Add to Cart and the newsletter form, so
it fixes both.

## New: Web SDK demo page (`websdk.html`)

A second, fully independent demo of the same storefront, this time built
on **alloy.js** (Adobe Experience Platform Web SDK) instead of
AppMeasurement.js + VisitorAPI.js. Reachable via the nav link on either
page ("Web SDK demo →" / "← Classic demo").

Unlike AppMeasurement/VisitorAPI, alloy.js itself is open source
(`@adobe/alloy` on npm, Apache 2.0) — no license file needed, just your
real `edgeConfigId`/`orgId` when you have them.

**Files:**

| File | Role |
|---|---|
| `js/websdk-config.js` | your `edgeConfigId` / `orgId` / consent category mapping |
| `js/websdk-loader.js` | installs the standard alloy command-queue stub, loads real `alloy.js` (or an offline shim if `useRealWebSDK: false`) |
| `js/websdk-adapter.js` | same public shape as `js/analytics.js` (`updateConsent`/`trackPageView`/`trackEvent`/`getVisitorId`/`getState`/`debug`), implemented via real `alloy("configure"/"setConsent"/"sendEvent"/"getIdentity")` calls |
| `js/websdk-app.js` | storefront + console wiring, calling `WebSDKAnalytics` instead of `AdobeAnalytics` |
| `js/websdk-consent-manager.js` | same banner/modal pattern as the Classic page, but its own `localStorage` key (`nt_consent_websdk_v1`) — the two pages' consent states are intentionally independent |

**Consent mapping** — Web SDK's real "Adobe" consent standard doesn't have
AppMeasurement's `aa`/`ecid` category codes; the closest real analogs are:

| This demo's toggle | Real Web SDK field |
|---|---|
| Analytics | `consent[0].value.collect.val` ("y"/"n") — the primary data-collection gate |
| Personalization | `consent[0].value.marketing.preferences.*Personalized` ("y"/"n") |

**Tracking calls** use genuine XDM event shapes — page views as
`web.webpagedetails.pageViews`, Add to Cart as `commerce.productListAdds`
with a real `productListItems` array, matching Adobe's own documentation
examples rather than demo-only shorthand.

**To point it at your real Datastream:** open `js/websdk-config.js` and set:

```js
edgeConfigId: 'your-datastream-edge-config-id', // Data Collection UI > Datastreams
orgId: 'YOUR-ORG-ID@AdobeOrg',
```

`useRealWebSDK` is `true` by default, so it loads real `alloy.js` from a
CDN immediately — you'll see real `sendEvent()`/`setConsent()` promise
resolutions in the console even with placeholder config; they just won't
successfully deliver to a real Datastream until the IDs are filled in.



## New: Tag Property mode (Data Collection UI / Launch embed)

Both the Classic and Web SDK pages can now load Adobe entirely through a
**Tag Property embed script** instead of standalone files — this is how
most real production sites actually deploy Adobe, so it's worth
demoing separately from the "legacy standalone files" and "raw CDN"
paths already covered above.

- **`js/adobe-loader.js`** (used by both `index.html` and
  `analytics-tag.html`) checks `ADOBE_CONFIG.tagPropertyUrl` first — if
  set, it injects that one embed script (Adobe Analytics + ECID + Opt-In
  Service extensions, all configured in the Adobe UI) and skips the
  standalone `vendor/adobe/*.js` files entirely. `js/analytics.js` /
  `js/analytics-tag-adapter.js` don't need to know which path was taken —
  they already lazily check for `window.s_gi` / `window.Visitor` /
  `window.adobe.optIn` on every call, which works whether those appeared
  synchronously (standalone files) or asynchronously (Tag Property).
- **`js/websdk-loader.js`** has the equivalent three-way branch for Web
  SDK: `tagPropertyUrl` set → inject that embed (its Web SDK extension
  calls `configure()` itself, so `js/websdk-adapter.js` skips its own
  `configure()` call) → else real `alloy.js` from the CDN → else the
  offline shim.

### New page: `analytics-tag.html`

A third, independent demo — same storefront and consent contract as
`index.html`, but deliberately configured with `appMeasurementUrl` /
`visitorApiUrl` left blank in `js/analytics-tag-config.js`, so it only
works once `ADOBE_CONFIG.tagPropertyUrl` is filled in with a real Adobe
Analytics Tag Property embed. Its own `js/analytics-tag-preinit.js` /
`js/analytics-tag-adapter.js` / `js/analytics-tag-consent-manager.js` are
copies of the Classic page's files with one change: an isolated
`localStorage` key (`nt_consent_analyticstag_v1`), so this page's consent
never mixes with the other two. `js/adobe-loader.js` and `js/app.js` are
shared verbatim — no copy needed, since neither hardcodes a storage key.

All three pages now cross-link via a pill switcher in the header
(Classic / Analytics (Tag) / Web SDK).

**To point either Tag Property page at a real property:**

```js
// js/analytics-tag-config.js (Adobe Analytics extension)
tagPropertyUrl: 'https://assets.adobedtm.com/launch-XXXXXXXXXXXX.min.js',

// js/websdk-config.js (Web SDK extension)
tagPropertyUrl: 'https://assets.adobedtm.com/launch-YYYYYYYYYYYY.min.js',
```

## File layout

```text
index.html                       Classic — standalone AppMeasurement + VisitorAPI files
analytics-tag.html                Adobe Analytics extension via Tag Property (Data Collection UI)
websdk.html                       Web SDK (alloy.js) — CDN or Tag Property — independent consent state
css/styles.css                    shared design system for all three pages

js/adobe-preinit.js               Classic page — deny-by-default optIn shim (nt_consent_v1)
js/adobe-config.js                Classic page — rsid/trackingServer/orgId + tagPropertyUrl
js/adobe-loader.js                shared — decides Tag Property embed vs standalone files
js/analytics.js                   Classic page — adapter (AdobeAnalytics)
js/app.js                         shared — storefront + console UI, used by all Classic-shaped pages
js/consent-manager.js             Classic page — banner/modal (nt_consent_v1)

js/analytics-tag-preinit.js       Tag Property page — same as adobe-preinit.js (nt_consent_analyticstag_v1)
js/analytics-tag-config.js        Tag Property page — appMeasurementUrl/visitorApiUrl left blank on purpose
js/analytics-tag-adapter.js       Tag Property page — same as analytics.js (nt_consent_analyticstag_v1)
js/analytics-tag-consent-manager.js  Tag Property page — same as consent-manager.js (nt_consent_analyticstag_v1)

js/websdk-config.js               Web SDK page — edgeConfigId/orgId + tagPropertyUrl
js/websdk-loader.js                Web SDK page — tagProperty / real CDN / offline shim
js/websdk-adapter.js               Web SDK page — adapter (WebSDKAnalytics)
js/websdk-app.js                   Web SDK page — storefront + console UI
js/websdk-consent-manager.js       Web SDK page — banner/modal (nt_consent_websdk_v1)

vendor/adobe/AppMeasurement.js
vendor/adobe/VisitorAPI.js
vendor/adobe/AppMeasurement_Module_AudienceManagement.js
vendor/adobe/AppMeasurement_Module_Integrate.js
```
