---
kind: story
size: 3
parent: "1442"
status: open
blockedBy: []
dateOpened: "2026-06-24"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, persistent-element, dockable, frontierui]
---

# Convert dockable to we-dockable custom element (persistent light-DOM/B)

Package the dockable block as a persistent light-DOM custom element per the #1750 ruling (mechanism B, codified §7). Register we-dockable as a class extends HTMLElement that, on connect, wires renderDockable over its light-DOM children and exposes the dock handle (serialize/restore + drag-to-dock topology + popout) as element methods — no shadow root, so adopted author panes keep inheriting page CSS and the as-built popout/serialize/drag machinery (#1510-1514) is untouched. In-leak isolation rides the #1349 webisolation contract; shadow (C) stays available only as a #1349-S2 opt-in for a future hostile host. Mirror the pan-zoom-surface #1707 / stepper / deck / tabs persistent-B converts. On land, #1442's catalog is fully drained and the epic resolves.
