---
type: issue
workItem: story
size: 3
parent: "193"
status: parked
dateOpened: "2026-06-11"
tags: []
---

# Port CompositeWidget to Frontier UI (decide Escape handling)

> **Parked (2026-06-11, via the #259 batch seam): demand-gated.** The build is fully specced (ruling
> below) and unblocked, but it is explicitly *"port `CompositeWidget` when a consumer needs it"* —
> `<auto-complete>` does not need it and no other consumer does yet. Building it now is speculative work
> on an unused component, so it is parked rather than batched. Un-park (→ `open`) the moment a Frontier
> UI consumer actually requires `CompositeWidget`; the spec below is ready to execute then.

> **Reclassified `decision` → `issue` (2026-06-11).** The Escape-handling fork is **already resolved** inline (see *Resolution of the Escape fork* below): Escape lives on the anchor/disclosure layer, not `CompositeWidget`. What remains is a **build** — port `CompositeWidget` into Frontier UI and add the missing Escape test — not a decision. Kept `workItem: story · size: 3` for that scope; the ruling below stands as the spec.

`CompositeWidget` was not carried into Frontier UI because `<auto-complete>` does not need it
(`Windowed` — its companion in the same plateau bullet — *was* already ported and lives at
`frontierui/blocks/droplist/Windowed.ts`). This item ports `CompositeWidget` when a consumer needs it.

Split from [#193](/backlog/193-droplist-frontierui-migration-followups/) (bullet 3).

## The decision this carries

The plateau `CompositeWidget` rewrite **dropped Escape handling** (clearSelection + blur) with no test.
Porting must decide **where Escape lives**:

- **Restore it on `CompositeWidget`** — the widget owns clearSelection + blur on Escape (the plateau
  pre-rewrite behavior), or
- **Assign Escape to the anchor/disclosure layer** — the `anchor` behavior already owns open/dismiss,
  so Escape-to-dismiss may belong there, keeping `CompositeWidget` free of keyboard policy.

Resolve this fork before/with the port, and add the Escape test that was missing.

## Acceptance

`CompositeWidget` is in Frontier UI with a chosen, tested Escape behavior; no regression to
`<auto-complete>`.

## Resolution of the Escape fork (2026-06-11)
**Escape lives on the anchor/disclosure layer**, not `CompositeWidget` — Escape-to-dismiss is a dismissal policy that belongs with the behavior already owning open/dismiss (one legitimate end-state → a fixed mechanic, not a configurable axis; mirrors how the Popover API pairs light-dismiss with open/close). `CompositeWidget` stays free of keyboard policy. **Item stays open**: the port itself is demand-gated ("when a consumer needs it") and still owes the missing Escape test.
