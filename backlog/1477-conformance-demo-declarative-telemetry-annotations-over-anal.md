---
kind: task
status: resolved
blockedBy: ["1475"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: demos/analytics-conformance-demo.ts
tags: []
---

# Conformance demo — declarative telemetry annotations over analytics-conformance-demo

Per #1415, extend the existing analytics conformance demo (we:src/_data/demos/analytics-conformance-demo.json, #1014) with declarative data-track annotations exercising the new emission seam (#1475) end-to-end: element annotation -> CustomTrackerRegistry resolution -> track() against a swappable sink, with the NoopTracker floor when unconfigured.

## Progress

Added a second runtime-conformance section to the demo exercising the `data-track` seam end-to-end on real annotated elements (`we:demos/analytics-conformance-demo.ts` + metadata in `we:src/_data/demos/analytics-conformance-demo.json`):
- **NoopTracker floor** — a `data-track` element with no registry in scope degrades silently (no throw).
- **annotation → resolution → track** — `data-track="click:cta-clicked"` + `data-track-props` resolves `window.customTrackers` and tracks the event + static props.
- **submit interaction** — `data-track="submit:…"` binds the form submit.
- **swappable sink** — swapping the resolved default backend reroutes subsequent emissions under the same annotation.
- `runConformance` made parametric (reused for both sections); `setPlaygroundReady` reports the combined pass count.
- Verified live on `:3000` via Playwright: **6/6 contract + 4/4 data-track** sections green, 0 fail badges (the one unrelated 500 is `we:blocks/navigation/NavSectionBehavior.ts`, a concurrent chrome issue not in this changeset). `check:standards` 0 errors.
