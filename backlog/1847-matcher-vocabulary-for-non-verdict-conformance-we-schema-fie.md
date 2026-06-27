---
kind: story
parent: "1294"
size: 5
status: resolved
relatedProject: webvalidation
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: conformance-vectors/schema.ts
tags: [conformance, relocation]
---

# Matcher vocabulary for non-verdict conformance — WE schema field + Plateau judge dispatch

Ratified #1816 settles the conformance comparison matcher for the #1294 non-engine relocations as a closed four-member set {exact · deep-equal · resolved-options/parts-structure · predicate}. This story builds the shared mechanism: add a per-key matcher field to the WE ConformanceExpectation schema (we:conformance-vectors/schema.ts) and per-key matcher dispatch in the Plateau judge (plateau:src/conformance-engine/conformanceVectors.ts, today hardcoded strict !== at ~142-147). Contract+vocabulary stay WE; the dispatch impl is Plateau; per-subsystem bindings ride each subsystem's /slice 1294 cascade. Unblocks the non-engine conformance slices for webtheme/intl/analytics/reliability.
