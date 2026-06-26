---
kind: story
size: 3
parent: "1442"
status: resolved
blockedBy: []
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1442
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, persistent-element, dockable, frontierui]
---

# Convert dockable to we-dockable custom element (persistent light-DOM/B)

Package the dockable block as a persistent light-DOM custom element per the #1750 ruling (mechanism B, codified §7). Register we-dockable as a class extends HTMLElement that, on connect, wires renderDockable over its light-DOM children and exposes the dock handle (serialize/restore + drag-to-dock topology + popout) as element methods — no shadow root, so adopted author panes keep inheriting page CSS and the as-built popout/serialize/drag machinery (#1510-1514) is untouched. In-leak isolation rides the #1349 webisolation contract; shadow (C) stays available only as a #1349-S2 opt-in for a future hostile host. Mirror the pan-zoom-surface #1707 / stepper / deck / tabs persistent-B converts. On land, #1442's catalog is fully drained and the epic resolves.

## Progress

Done (resolved 2026-06-26). A thin persistent-light-DOM packaging facade over the as-built dockable kernels, mirroring `fui:blocks/pan-zoom-surface/PanZoomSurfaceElement.ts` (#1707):

- `fui:blocks/dockable/DockableElement.ts` — `class WeDockableElement extends HTMLElement` + idempotent parameterized `registerWeDockable(tag = 'we-dockable')` (#841). On connect: injects `WE_DOCKABLE_CSS` + `WE_DOCK_DRAG_CSS` once, marks `this[data-dock-root]` + the `we-dockable` scope class (so `serializeDockable`/drag hit-test key off it), and wires `attachDockSplits(this)` + `attachDockDrag(this, …)` over its **light-DOM** children — **no shadow root**, so adopted panes inherit page CSS and the #1510–1514 machinery is untouched. Exposes `serialize()` / `restore(layout)` / `popout(panelId, opts?)` as element methods; re-emits a successful dock as a bubbling `dock` CustomEvent (`edge-fraction` observed attr). `disconnectedCallback` detaches both behaviors.
- `fui:blocks/dockable/index.ts` — exports `WeDockableElement` + `registerWeDockable`.
- `fui:blocks/__tests__/unit/dockable/DockableElement.test.ts` — 5 happy-dom vectors (dock-root marking + no-shadow, restore→light-DOM children, serialize round-trip, the `dock` event contract, teardown/re-wire). 5/5 green.

FUI gate at the 34-error pre-existing baseline (unrelated upgrader/resource-loader debt; my changeset adds none). **Drains the #1442 catalog** — the persistent-B converts are complete, so #1442 is now resolvable (all children done).
