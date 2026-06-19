---
type: idea
workItem: story
size: 3
parent: "1003"
status: resolved
blockedBy: ["1012"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/analytics-conformance-demo.ts"
tags: []
---

# webanalytics: conformance demo — swap the resolved backend, assert events route

Slice D of #1003. demos/analytics-conformance-demo.{html,ts,css} + a `we:src/_data/demos.json` entry: one call site, swap the resolved backend via the CustomTrackerRegistry, assert the same track()/identify()/page()/group() calls route to each backend — using in-demo recording-stub adapters (honest for a browser demo: real GA4/Mixpanel need network + credentials). Proves the contract+injector swap mechanic, the core conformance claim. Blocked only on the contract+registry (slice A), not the real vendor adapters (B).

## Progress (batch-2026-06-18)

Shipped the conformance demo proving the #1012 contract+injector swap mechanic:
- `we:demos/analytics-conformance-demo.{html,ts,css}` — one call site, the same identify/track/page/group,
  the resolved backend swapped underneath via `CustomTrackerRegistry`. Backends are in-demo recording stubs
  (honest for a browser demo; real GA4/Mixpanel/Segment is the #1013 vendor-adapter impl).
- Runtime-conformance section (6 live invariants, all green in-browser): native-first no-op default,
  full identify/track/page/group routing, the backend-swap reroute, Segment `page(category, name)` arg
  order, per-call `trackerKey` routing, and unknown-backend → `UnknownTrackerError`. `setPlaygroundReady`
  reports the pass count.
- `we:src/_data/demos.json` entry (`analytics-conformance-demo`, projects: webanalytics) — auto-covered by
  the existing `we:plugs/__tests__/e2e/playgrounds.spec.ts` loads-green smoke. Verified live on :3000
  (6/6, no console errors).
