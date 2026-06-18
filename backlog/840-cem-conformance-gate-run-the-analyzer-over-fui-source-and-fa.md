---
type: idea
workItem: story
size: 8
status: open
blockedBy: ["838", "839"]
locus: frontierui
dateOpened: "2026-06-17"
tags: []
---

# CEM conformance gate: run the analyzer over FUI source and fail on drift against WE's declared CEM

The home for the #801-rejected analyzer-as-source engine, recast as verifier (the #463 deterministic-conformance posture): FUI runs @custom-elements-manifest/analyzer over block source and the derived CEM is compared to WE's authored/declared CEM, failing the gate on drift. Also where the deferred programmatic/private JS surface (excluded from WE's authored contract per Fork-1=B) can be impl-scanned if a programmatic-API table is ever wanted. Separately-prioritized; blocked by #838 (needs the authored CEM to compare against).

**Also blockedBy #839 + locus retag (added 2026-06-17, batch pre-flight).** Verified: WE's emitted `we:custom-elements.json` currently has **0 custom-element declarations** (75 plain `class` declarations) because no `fui:blocks.json` entry carries a `tagName` — gen-cem only emits a `customElement` when a tag is present. A conformance gate that drift-checks FUI's analyzer-derived custom-elements against "WE's declared CEM" therefore has **nothing to compare against**, and the element-alignment key (tagName) doesn't exist until [#841](/backlog/841-decide-the-we-contract-custom-element-tag-naming-convention/) ratifies and the surface is authored ([#839](/backlog/839-backfill-authored-public-api-member-fields-attributes-proper/), itself blockedBy #841). So this waits on #839. Also retagged `locus: frontierui` — the gate runs `@custom-elements-manifest/analyzer` (not installed in FUI yet) over **FUI block source** and lives alongside #783's Check 2 in `fui:frontierui/scripts/check-standards.mjs` (the WE→impl conformance direction #822 ruled).
