---
type: idea
workItem: story
size: 5
parent: "1001"
status: open
blockedBy: ["1148"]
dateOpened: "2026-06-19"
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — logical event propagation (composedLogical + logicalPath)

Slice of #1001 (after the logical-tree polyfill #1148): events bubble through the logical tree. Add a separate opt-in composedLogical flag on EventInit + composedLogicalPath() — ORTHOGONAL to native composed, never an overload; Event.logicalPath computed PRE-retarget as a parallel pass over the logical chain, with a fresh retarget at each logical hop whose host is the portal's DECLARATION element (not its mount/outlet) so a listener's event.target stays in its own logical tree; stopLogicalPropagation(). Built in we:plugs/webportals/. Per #1000 Fork 2.
