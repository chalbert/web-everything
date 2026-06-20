---
kind: story
size: 3
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/nativeFirstWatch.json
tags: []
---

# Make the view-transitions standard defer to native same-document View Transitions

Same-document View Transitions became Baseline Newly Available (Oct 2025; Firefox 144). The view-transitions protocol (#015) should register the native startViewTransition plus the view-transition CSS properties as its resolver impl per native-first (#031); track cross-document view transitions as they progress. Surfaced by the 2026-06-20 platform-standards watch (#1257).

## Progress

Resolved 2026-06-20. **Baseline verified** via web-features: `view-transitions` is `status.baseline:
"low"` (newly available) since 2025-10-14 — matches the item.

Registered the native as the resolver in the **front-A watch ledger** (we:src/_data/nativeFirstWatch.json
`view-transitions` → `registered: true`, metric 4/6). The ledger is the right home here, established by a
false start: I first added a we:src/_data/capabilities/view-transitions.json entry, but the capabilities registry is the
**droplist/overlay substrate axis of the capabilityMatrix** (the matrix is a complete impl × capability
grid, so every impl — `face`, `base-select` — would have to tier `view-transitions`, which is out of their
domain). view-transitions is not a droplist-substrate capability, and the view-transitions protocol (#015)
has no materialized registry def to host a resolver field — so the native-first registration is recorded in
the watch ledger, which IS the front-A native-first registry (#1267). `registeredIn` documents this.
The actual `startViewTransition()` + `::view-transition-*` wiring is FUI impl, downstream of this
standards registration; cross-document view transitions noted as tracked separately. Gate green.
