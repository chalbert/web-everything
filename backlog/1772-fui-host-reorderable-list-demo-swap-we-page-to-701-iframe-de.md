---
kind: story
size: 5
parent: "1353"
status: open
dateOpened: "2026-06-24"
blockedBy: [1776]
relatedProject: webblocks
tags: [frontierui, demos, blocks, fui-build-gate]
---

# FUI-host reorderable-list demo, swap WE page to #701 iframe, delete we:blocks/renderers/reorderable-list

The last FUI-build gate cleared: #1765 ported the cross-list reorder twin + fixtures into
`fui:blocks/renderers/reorderable-list/`, so FUI now has the full renderer family (within-list since
#920, cross-list as of #1765). This is the trivial demo-swap+delete tail: build the self-bootstrapping
`fui:demos/reorderable-list-demo.html` (within-list playground + cross-list Kanban), swap
`we:demos/reorderable-list-demo.ts` to a #701 `fuiDemo` iframe, then delete the two WE runtime renderers
under `we:blocks/renderers/reorderable-list/` (renderReorderableList + renderCrossListReorder) plus the
runtime-bound files: the two per-renderer suites under `we:blocks/__tests__/unit/renderers/` (reorderable-list
+ cross-list-reorder) and the two golden capture generator modules under
`we:blocks/renderers/reorderable-list/__fixtures__/` (the `goldens` generators that import the renderer).
**Keep** the cases-input modules and the frozen golden JSON corpora in that same `__fixtures__/` directory
— those ARE the conformance vectors WE retains, validated data-only by `we:blocks/renderers/golden-schema.ts`
and its suite (the surviving conformance #1776 stood up; deleting them would break `npm run verify`).
Mirrors the data-table end-state (#1355/#1531: the renderer is gone but
`we:blocks/renderers/data-table/__fixtures__/` and `we:blocks/renderers/data-table/types.ts` are kept) and
the #1357 pattern under #1353.

**Blocked on [#1776]** (surfaced 2026-06-24): the runtime-delete half can't land until WE's two
reorderable-list unit tests are converted to stored-golden data-readers — they currently execute the
runtime, so the delete would break `npm run verify`. This is the same verifier-golden prerequisite
#1356 (pagination) / #1494 (data-table) cleared before their swap+delete slices. The FUI demo build +
iframe swap could land independently, but the pattern is golden-slice-first, so this stays gated.
