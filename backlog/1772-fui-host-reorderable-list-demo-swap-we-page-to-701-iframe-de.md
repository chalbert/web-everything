---
kind: story
size: 5
parent: "1353"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: frontierui/demos/reorderable-list-demo.html
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

**~~Blocked on [#1776]~~ cleared (2026-06-24):** #1776 stood up the data-only golden suite
(`we:blocks/renderers/golden-schema.ts` assertReorderableListGoldens/assertCrossListReorderGoldens over
the frozen corpora), so the two WE unit suites that executed the runtime were safe to delete without
breaking `npm run verify`. Same verifier-golden prerequisite #1356 (pagination) / #1494 (data-table)
cleared before their swap+delete slices.

## Progress

- **Status:** resolved (2026-06-24). Branch: main.
- **Done:**
  - WE: extracted `we:blocks/renderers/reorderable-list/types.ts` (contract types — the data-table-mirror
    end-state) and repointed both retained cases modules
    (`we:blocks/renderers/reorderable-list/__fixtures__/reorderable-list-cases.ts`,
    `we:blocks/renderers/reorderable-list/__fixtures__/cross-list-reorder-cases.ts`) from the renderers to `../types`.
  - WE: deleted the two runtime renderers (`we:blocks/renderers/reorderable-list/renderReorderableList.ts`,
    `we:blocks/renderers/reorderable-list/renderCrossListReorder.ts`), the two renderer-bound unit suites
    (`we:blocks/__tests__/unit/renderers/reorderable-list.test.ts` +
    `we:blocks/__tests__/unit/renderers/cross-list-reorder.test.ts`), and the two golden-generator modules
    (`we:blocks/renderers/reorderable-list/__fixtures__/reorderable-list-goldens.ts` +
    `we:blocks/renderers/reorderable-list/__fixtures__/cross-list-reorder-goldens.ts`). KEPT the cases-input
    modules + frozen `*-goldens.json` corpora (validated data-only by `we:blocks/renderers/golden-schema.ts` — 10/10 green).
  - WE: swapped `we:demos/reorderable-list-demo.html` to a #701 fuiDemo iframe shell (embeds :3001) and
    deleted `we:demos/reorderable-list-demo.ts` + `we:demos/reorderable-list-demo.css`.
  - FUI: built the self-bootstrapping `fui:demos/reorderable-list-demo.html` +
    `fui:demos/reorderable-list-demo.ts` + `fui:demos/reorderable-list-demo.css` — within-list playground
    (4 static action-replay cards + 1 live keyboard grab-then-move card) + cross-list Kanban (replays the
    shared cross-list-reorder-cases fixtures), each card running the SAME auditReorderableList /
    auditCrossListReorder CI asserts. Registered in `fui:demos/__tests__/playgrounds.spec.ts`.
  - Verified: FUI playground e2e green (playgroundReady, all badges pass, 0 console errors); live
    keyboard grab→move→drop reorders correctly + announces + stays conformant; FUI 42 reorderable units
    green; WE golden-schema 10/10 + `check:standards` 0 errors.
