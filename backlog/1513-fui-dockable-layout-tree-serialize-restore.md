---
kind: story
size: 2
parent: "1485"
locus: frontierui
status: resolved
blockedBy: ["1511"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
tags: []
---

# FUI dockable layout-tree serialize / restore

Slice of #1485 (locus:frontierui): serialize the live partition tree to the {type:row|column|stack, children|tabs, size} shape and rehydrate it (round-trip). This is the first conforming impl that validates the #1486 core schema, satisfying the protocol-bar temporal rule so #1486 can be extracted. blockedBy #1511 (container render).

## Progress

- `fui:blocks/dockable/serializeDockable.ts` — `serializeDockable(root)` reads a live rendered tree (post-resize / post-dock / post-tab-switch) back into the pure `DockLayout` contract shape; `restoreDockable` re-exports `renderDockable` (rehydrate = re-render), so the conformance round-trip reads as `restoreDockable(serializeDockable(root))`.
- Extended `fui:blocks/dockable/renderDockable.ts` so the open `ext` slot (#1486) and `popout` ride opaquely on data attributes (`data-dock-ext` JSON, `data-dock-popout`, `data-panel-popout`), surviving the round-trip without the core render reading them. Additive — slice #1511's render + resize tests unchanged.
- Sizing reads back off the inline flex the renderer wrote: a non-zero px `flex-basis` ⇒ `pixel` (with `min`/`max` bounds), else the `flex-grow` weight ⇒ `ratio`. Reflects LIVE state — a divider-drag rewrite serializes the new proportions.
- Round-trip unit test (`serializeDockable.test.ts`): `serialize ∘ render === identity` on a canonical layout (recursion, ratio + pixel sizing, non-default activeTab, non-closable panel, ext, popout) + idempotence of `serialize ∘ restore`. Exported from the dockable barrel. 19/19 dockable unit tests green.
- Representable-state limits (documented in the module, faithful to slice #1511's render): ratio `min`/`max` aren't rendered onto ratio panes so don't round-trip; a panel `title` equal to its `id` serializes without a title (DOM-indistinguishable from the no-title default).
