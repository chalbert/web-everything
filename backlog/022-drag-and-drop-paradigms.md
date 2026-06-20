---
kind: story
size: 5
status: resolved
dateOpened: '2026-06-02'
dateStarted: '2026-06-06'
dateResolved: '2026-06-06'
graduatedTo: intent:reorder
tags:
  - drag-and-drop
  - reorder
  - interaction
  - traits
  - intents
  - paradigms
  - accessibility
relatedProject: webtraits
relatedReport: reports/2026-06-06-reorder-paradigms.md
---

# Codify drag-and-drop as composable intents & traits

Drag-and-drop is not one component but a composition of reusable interaction paradigms — capture it the way the droplist family was, then codify the pieces as intents and traits. Surfaced by the need to reorder the backlog itself: rather than build a one-off DnD, define the standard first. Decomposes into drag-source, drop-target, reorderable-list, drag-handle, keyboard-reorder (the accessible equivalent, non-optional), and a commit/persistence strategy — each surfacing as a trait (component/behavior/provider) and mapping to a native substrate.

### Why it's here

Reordering the backlog surfaced the need. Rather than build a one-off drag-and-drop, define the standard — the same move as the droplist, where a "dropdown" turned out to be a composition, not a component.

### Candidate paradigms → intents/traits

- **drag-source** — an element that can be picked up (behavior).
- **drop-target / drop-zone** — a region that accepts a payload, validating what it accepts (behavior + provider).
- **reorderable-list** — an ordered collection whose order is user-mutable (component + a provider for the order model).
- **drag-handle** — a scoped grab affordance vs. whole-element drag (behavior).
- **keyboard-reorder** — the accessible equivalent (roving tabindex + move up/down + live-region announce); part of the contract, not an add-on.
- **commit / persistence strategy** — where the new order is written (ephemeral, localStorage, or back to source) — a provider, mirroring the droplist's resolution model.

### Native substrate

- HTML5 Drag and Drop API (`draggable`, `dragstart/dragover/drop`) — ubiquitous but clunky and weak for touch/a11y.
- Pointer Events — the real foundation for custom, touch-capable DnD.
- `Element.moveBefore()` (atomic move) — recent primitive that relocates a node *without* resetting its state (focus, animations, iframes, custom-element connected callbacks). Exactly what reordering interactive cards needs; pair it with the trait model.
- Accessibility: `aria-grabbed`/`aria-dropeffect` are deprecated — the standard should mandate the keyboard-reorder + live-region pattern instead.

## Progress
- **Status:** resolved — DnD's *reorder* family codified as intent + traits + block spec + semantics + report. Implementation/demo split to #130.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `reorder` intent in `we:intents.json` (dimensions: grab/movement/commit/announce/scope; keyboard parity mandatory; manual order ≠ Collection Operations' computed sort).
  - `reorderable-list` block (`concept`) + 6 traits (`withDragHandle`, `withPointerReorder`, `withKeyboardReorder`, `withLiveAnnounce`, `withCommitStrategy`, `withCrossListReorder`) mapped to `reorder.*` dimensions; `we:block-descriptions/reorderable-list.njk`.
  - 5 semantics terms (Reorder, Reorderable List, Drag Handle, Keyboard Reorder, Reorder Commit Strategy).
  - `we:reports/2026-06-06-reorder-paradigms.md` (prior art, native substrate, feature inventory, open points) — mirrored here via `relatedReport`.
  - Cross-referenced #007 (it now owns only the data-transfer half) and #084 (`preserve-on-move`/`Element.moveBefore()` substrate).
  - `gen:inventory` + `check:standards` green (0 errors); eleventy build renders `/intents/reorder/` and `/blocks/reorderable-list/`.
- **Next:** Implementation + fixture-driven conformance demo → **#130** (keyboard-reorder headline case).
- **Notes:** Intents are UX-only. Traits = `withX` with `intentDimension`. Reorder vs data-transfer split is the key modeling call; data-transfer stays #007.
