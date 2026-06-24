---
kind: story
size: 5
parent: "1353"
status: open
dateOpened: "2026-06-24"
relatedProject: webblocks
tags: [frontierui, blocks, renderers, conformance, fui-build-gate]
---

# WE reorderable-list golden-vector conformance — redesign auditReorderableList + auditCrossListReorder into stored-golden data-readers (per #1467/#899)

Prerequisite for the #1772 backend-delete (surfaced while working it): WE's two
reorderable-list unit tests — `we:blocks/__tests__/unit/renderers/reorderable-list.test.ts`
(within-list) and `we:blocks/__tests__/unit/renderers/cross-list-reorder.test.ts` —
still **execute the runtime** (`renderReorderableList` / `renderCrossListReorder`)
to audit each fixture, so deleting the WE runtime would break `npm run verify`
with no replacement. Per the #1467/#899 model (and the #1356 pagination / #1494
data-table precedent), redesign both audits into **stored-golden data-readers**:
render each fixture once, freeze the DOM-shape goldens into per-fixture golden
files under `we:blocks/renderers/reorderable-list/__fixtures__/`, and validate
them via the existing `we:blocks/renderers/golden-schema.ts` reader — so WE keeps
verifying its published vectors as **data**, no impl. Then #1772 can delete the
runtime backend. FUI already runs the same vectors against its impl (#1765).
