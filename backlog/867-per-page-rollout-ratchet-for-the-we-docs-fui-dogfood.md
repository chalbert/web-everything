---
kind: decision
parent: "777"
status: open
dateOpened: "2026-06-17"
dateStarted: "2026-07-02"
tags: []
---

# Per-page rollout ratchet for the WE-docs FUI dogfood

Convert the WE-docs page set incrementally to FUI-mounted chrome/UI behind the #770 rendered-site a11y gate, so each conversion is proven WCAG-clean; mirror to FUI's own site where not already dogfooded. Follows the chrome + page-UI migration slices.

## Reclassified story → decision (2026-07-02, batch-2026-07-02 parallel run)

A batch lane claimed this and landed **zero files** (`blocked-in-fact`). Investigation: the declared `blockedBy: [865, 866]` is **stale — both resolved** (#865 chrome→FUI, graduated to `we:src/_data/chrome.js`; #866 page-UI umbrella, all 4 child slices #1598–#1601 done), and the per-page ratchet **infrastructure already exists** (#770 resolved: `ENFORCED_ROUTES` set + warn→enforce posture + sitemap-derived routes). Pages already render `<we-badge>`/`<we-card>` etc. So there is no missing artifact — but no concrete residual work is specified either.

**The open decision:** is anything actually left, and if so what shape — (a) essentially done (confirm + close), (b) a mechanical promotion task (add remaining verified pages to `ENFORCED_ROUTES`), or (c) a rollout-strategy decision (order/criteria for promoting pages behind the gate)? Stale `blockedBy` cleared. Needs a judgment turn before it can be built or closed; do **not** auto-batch until decided.
