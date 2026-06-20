---
type: idea
workItem: story
size: 8
status: open
locus: frontierui
dateOpened: "2026-06-20"
tags: [deck, dogfood, fui, conformance]
---

# Build the deck components on FUI (critical-path doc-model/layouts/advance + pass deck vector suites #1183/#1195)

The single FUI build that gates the deck dogfood (#1210). Per the readiness map (we:reports/2026-06-20-deck-dogfood-readiness-map.md): all 19 deck contracts are spec'd (19/19) but FUI 0/19 — so FUI must build the deck components against the critical-path contracts (#1180 slide/deck doc-model, #1191 layout-template vocabulary, #1179 advance/build orchestration) and pass the two conformance vector suites (#1183, #1195). FUI-owned per the constellation seam (mirrors the #777 dogfood pattern: WE specs, FUI builds). Resolving this unblocks #1210 to render the real WE pitch deck on its own stack.
