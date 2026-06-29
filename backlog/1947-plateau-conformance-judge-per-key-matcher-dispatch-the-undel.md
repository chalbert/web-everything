---
kind: story
size: 5
parent: "1294"
status: active
dateOpened: "2026-06-28"
dateStarted: "2026-06-29"
tags: []
---

# Plateau conformance-judge per-key matcher dispatch (the undelivered #1847 half)

The plateau conformance judge (plateau-app:src/conformance-engine/conformanceVectors.ts) still compares every non-special expect key with hardcoded strict equality (last[key] !== expected, ~lines 142-147) and never dispatches on the per-key matcher vocabulary #1847 defined. #1847 resolved but delivered ONLY the WE schema half (graduatedTo we:conformance-vectors/schema.ts); the Plateau judge half (treat 'matchers' as metadata; dispatch per-key exact / deep-equal / resolved-options-parts-structure / predicate) was never built, so any conformance suite whose vectors use a matcher fails ALL vectors with 'matchers expected {...}, observed undefined'. Cross-cutting: blocks the intl/analytics/reliability docs-page wirings (#1920/#1921/#1922) which need predicate/array comparison. Implement the dispatch in plateau-app:src/conformance-engine/conformanceVectors.ts, then the page-wiring slices become clean mirrors of #1801.
