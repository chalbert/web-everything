---
kind: story
size: 13
status: open
locus: frontierui
dateOpened: "2026-06-20"
tags: [frontierui, demos, dogfood, fui-build-gate]
---

# FUI re-host the bootstrap + demo-consuming pages that gate the remaining WE block-runtime deletes (#1245)

The remaining #1245 WE block-runtime deletes (7 bootstrap families router/navigation/parsers/text-nodes/for-each/transient/attributes; wizard+workflow-engine; resource-loader; stores; renderers ×11) can only drop after their ~12 consuming demos are re-hosted FUI-side and embedded via the #701 fuiDemo iframe. Most FUI-side equivalents don't exist yet (wizard-flow, loader-background-handoff, data-table, pagination, reorderable, component-adapter, jsx-adapter — none in fui:demos/). This is the FUI build gate; carve per-demo as each ships, then WE swaps the local page to an iframe and deletes the family.
