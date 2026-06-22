---
kind: story
size: 3
parent: "1254"
locus: plateau-app
status: open
dateOpened: "2026-06-22"
tags: []
---

# plateau-app Platform Map onto FUI graph/node-viz block

Migrate the Platform Map (plateau:src/platform-manager/platform-map.ts) off the hand-rolled viz onto the FUI graph/node-viz default impl. Ratchet release of #1254 now that the graph/node-viz gap #1289 shipped (we:graphs/contract.ts + fui:graphs/LayeredDagLayout.ts + fui:graphs/SvgGraphRenderer.ts). Read-only floor matches v1; gates on a rendered a11y/visual check per first-party-dogfood.
