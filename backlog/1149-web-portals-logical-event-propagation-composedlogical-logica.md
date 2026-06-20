---
kind: story
size: 5
parent: "1001"
status: resolved
blockedBy: ["1148"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: plugs/webportals/Event.logical.patch.ts
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — logical event propagation (composedLogical + logicalPath)

Slice of #1001 (after the logical-tree polyfill #1148): events bubble through the logical tree. Add a separate opt-in composedLogical flag on EventInit + composedLogicalPath() — ORTHOGONAL to native composed, never an overload; Event.logicalPath computed PRE-retarget as a parallel pass over the logical chain, with a fresh retarget at each logical hop whose host is the portal's DECLARATION element (not its mount/outlet) so a listener's event.target stays in its own logical tree; stopLogicalPropagation(). Built in we:plugs/webportals/. Per #1000 Fork 2.

## Resolution

Built in `we:plugs/webportals/Event.logical.patch.ts`, wired into `we:plugs/webportals/index.ts` (the existing `applyPatches`/`removePatches`/`isPatched` triple now also drives the Event patch), per the ratified #1000 Fork 2 contract. The four ratified surfaces:

- **`composedLogical` + `bubblesLogical`** — separate opt-in `EventInit` flags (both default false). `composedLogical` crosses LOGICAL (portal) boundaries — orthogonal to native `composed` (shadow boundary), never an overload. Native `dispatchEvent` cannot read custom init fields, so the driver is `dispatchLogical(target, event, init)`: it runs the native DOM leg, then the logical leg up the chain.
- **`Event.logicalPath`** (read-only) — the pre-retarget logical chain (`target → …ancestors`), built by walking a logical hop when a node declares a `logicalParent`, else the DOM `parentElement` (DOM-then-logical bubbling per spec `:366`); populated during a `dispatchLogical` run with `bubblesLogical: true`.
- **`Event.composedLogicalPath()`** — full chain for a `composedLogical` event; otherwise trimmed at the first logical (portal) boundary, mirroring how native `composedPath()` stops at the shadow boundary for a non-`composed` event.
- **`Event.stopLogicalPropagation()`** — halts the logical leg only.

Retarget rule (the #1000 Fork 2 sub-decision): a fresh retarget runs at each logical hop, scoped to the DECLARATION element (the `logicalParent`, not the mount/outlet), so a logical-ancestor listener never sees the physical outlet. The physical site stays reachable via native `composedPath()`.

Logical listeners live in a separate table (`addLogicalEventListener`/`removeLogicalEventListener`, the #606 non-invasive surface) so the DOM and logical legs stay independent. Covered by `we:plugs/webportals/__tests__/unit/webportals.event.test.ts` (11 tests, plugged + unplugged).
