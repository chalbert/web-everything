---
kind: story
size: 8
status: resolved
dateOpened: '2026-06-06'
dateResolved: "2026-06-07"
graduatedTo: blocks/renderers/reorderable-list/ (Reorderable List block, status draft) + demos/reorderable-list-demo.* (Reorderable List Playground)
tags:
  - reorder
  - drag-and-drop
  - reorderable-list
  - accessibility
  - block
  - implementation
relatedReport: reports/2026-06-06-reorder-paradigms.md
relatedProject: webtraits
crossRef: { url: /blocks/reorderable-list/, label: Reorderable List block }
---

# Implement the Reorderable List block + conformance demo

The [`reorder` intent](/intents/reorder/) and the [Reorderable List block](/blocks/reorderable-list/)
spec are authored (status `concept`) under [#022](/backlog/022-drag-and-drop-paradigms/). This item
builds the implementation and the **fixture-driven conformance demo** that promotes the block past
`concept` — with **keyboard-reorder as the headline case**, since accessibility is part of the contract,
not an add-on.

## Scope

- Pointer-drag path via Pointer Events + `setPointerCapture` (`withPointerReorder`).
- Keyboard path: roving tabindex + grab/move/drop keys + live-region announcement
  (`withKeyboardReorder` + `withLiveAnnounce`) — composes `focus-delegation` and `live-region-status`.
- Atomic relocation via `Element.moveBefore()` through the Component block's `preserve-on-move`
  ([#084](/backlog/084-component-preserve-on-move/)), with an `insertBefore` fallback.
- `withDragHandle` (scoped grab), `withCommitStrategy` (ephemeral default; persisted via the cancelable
  `reorder-commit` event), `withCrossListReorder` (sibling lists sharing a group key).
- A shared fixture + conformance playground case the demo renders, per the Definition of Done.

## Decisions to settle first (from the report's Open Points)

- **Keyboard keymap** — recommended **grab-then-move** (`Space` lift, arrows move, `Space`/`Enter` drop,
  `Esc` cancel), matching APG drag guidance and dnd-kit's keyboard sensor.
- **Commit-strategy shape** — start as the `commit` attribute; promote to a `CustomReorderCommitRegistry`
  only if multiple persistence backends emerge.

See `we:reports/2026-06-06-reorder-paradigms.md` for prior art, the native-substrate analysis, and the
full Open Points register.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `we:blocks/renderers/reorderable-list/renderReorderableList.ts` — pure DOM-free `reduceReorder`
    grab-then-move engine, `renderReorderableList` reference renderer, `reconcileOrder` (atomic
    `Element.moveBefore()` relocation with `insertBefore` fallback), `announce` live-region wording,
    `auditReorderableList` conformance audit.
  - `we:__fixtures__/reorderable-list-cases.ts` — 8 shared fixtures (rove, grab, move, End, commit,
    cancel/revert, edge-clamp) driving both the demo and CI.
  - `we:blocks/__tests__/unit/renderers/reorderable-list.test.ts` — 26 conformance + unit tests (all pass).
  - `demos/reorderable-list-demo.{ts,html,css}` — playground: 8 fixture cards + a live interactive
    card (real keyboard grab-and-move, pointer drag, live region, cancelable `reorder-commit`).
    Registered in `we:demos.json`; E2E playground spec green.
  - `fui:blocks.json` — block status `concept` → `draft`, added `sourcePath` + `exports`. we:AGENTS.md
    inventory regenerated.
- **Decisions settled:** keyboard keymap = grab-then-move (Space grab, arrows move, Space/Enter drop,
  Esc cancel); commit-strategy = `commit` attribute + cancelable `reorder-commit` event (no registry).
- **Verification:** `check:standards` 0 errors; 1468 unit tests pass; Reorderable List Playground E2E
  loads green with no console errors.
- **Follow-ups filed:** [#146](/backlog/146-cross-list-reorder-trait/) (cross-list reorder, Tier 2),
  [#147](/backlog/147-reorder-drop-position-indicator/) (`[data-reorder-target]` drop-position hook).
