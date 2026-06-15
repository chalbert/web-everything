---
type: idea
workItem: story
size: 2
parent: "479"
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: capabilities/baseline-lookup.ts
tags: []
---

# web-features-backed BaselineLookup for the edge venue

Back the edge venue's injected BaselineLookup (capabilities/edge-io.ts:69) with real Baseline data: add the web-features npm package (data-only dep, no runtime lock-in), map a browser brand+version to the Baseline epoch (year) it meets, and unit-test the impl against the injection seam (mirror capabilities/__tests__/edge-io.test.ts:47). The impl direction is settled (edge-io.ts:20 names web-features; capability ids already borrow Baseline keys per #204) — no fork, just the install + mapping. Carved from #479.

## Progress

- **2026-06-15 — built + verified.** Added `web-features@^3.30` (data-only dep) and
  `capabilities/baseline-lookup.ts`: `createBaselineLookup()` builds, once, a per-browser monotonic
  `requiredVersion[year]` table from the dataset (a version meets Baseline year Y iff it supports every
  feature that reached Baseline on/before end-of-Y), and returns a `BaselineLookup` that maps a CH
  brand+version → the highest year it clears. Brand→`web-features` key resolution covers Chromium / Chrome
  / Edge / Firefox / Safari, platform-aware to the `_android` / `_ios` variants. `edge-io.ts` stays pure —
  the data dep lives only in this injected impl.
- **Data footgun handled:** `web-features` records some support versions as `"≤15"` (available *at or
  before*); `parseFloat` returned `NaN`, which (as a missing-support sentinel) poisoned the whole browser
  to `undefined`. `toVersionNumber` now extracts the leading number, so `≤15`→15. Spot-checked: Chromium
  130→2024, Edge 130→2024, Firefox 130→2023, Safari 17→2022, monotonic in version, ancient/unknown→
  undefined.
- **Tested against the seam:** `capabilities/__tests__/baseline-lookup.test.ts` (9 tests) — direct lookup
  behaviour (recent→recent epoch, monotonicity, ancient→undefined, unknown brand→undefined, Edge
  resolution, Android variant) plus the `parseClientHints` injection path mirroring `edge-io.test.ts`
  (real headers → numeric `baselineYear`; ancient client → honest `{}`). Range/relative assertions, not
  brittle exact years. Full `capabilities` + `edge-io` suites green; `npm run check:standards` 0 errors.
