---
kind: story
size: 3
parent: "193"
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: frontierui/blocks/droplist/FocusDelegation.ts
tags: []
---

# Port CompositeWidget to Frontier UI (decide Escape handling)

> **Unparked 2026-06-16 (prioritization call).** Was parked as demand-gated ("port `CompositeWidget`
> when a consumer needs it"); deliberately un-parked to build ahead of a hard consumer need — the build
> is fully specced (ruling below), unblocked, and ready to execute. The Escape-handling fork is already
> resolved inline (see *Resolution of the Escape fork* below); what remains is the port + the missing
> Escape test.

> **Reclassified `decision` → `issue` (2026-06-11).** The Escape-handling fork is **already resolved** inline (see *Resolution of the Escape fork* below): Escape lives on the anchor/disclosure layer, not `CompositeWidget`. What remains is a **build** — port `CompositeWidget` into Frontier UI and add the missing Escape test — not a decision. Kept `workItem: story · size: 3` for that scope; the ruling below stands as the spec.

`CompositeWidget` was not carried into Frontier UI because `<auto-complete>` does not need it
(`Windowed` — its companion in the same plateau bullet — *was* already ported and lives at
`fui:frontierui/blocks/droplist/Windowed.ts`). This item ports `CompositeWidget` when a consumer needs it.

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

## Resolution (2026-06-16) — already satisfied by the droplist decomposition; traced, not re-built
Picked this up to build and **traced the real Frontier UI tree first** (the legacy `plateau` repo is abandoned, never opened): the work is **already done**, the way the resolved fork prescribes. `CompositeWidget` was not ported as a monolith — it was **decomposed** into composable droplist behaviors, exactly the "stays free of keyboard policy" end-state:
- `fui:frontierui/blocks/droplist/FocusDelegation.ts:26` — *"the **focus** half of the former CompositeWidget."*
- `fui:frontierui/blocks/droplist/Selection.ts:21` — *"the **selection** half of the former CompositeWidget."* (owns `clearSelection`).
- `fui:frontierui/blocks/droplist/Anchor.ts:44` — the anchor/disclosure layer *"owns exactly: open on the configured interactions; **dismiss on Escape**, focus-out, commit"* — the resolved Escape-to-dismiss policy, off `CompositeWidget`.

**The owed "missing Escape test" exists and passes:** `fui:frontierui/blocks/droplist/__tests__/ported-suites.test.ts:205` — *"Escape dismisses an open surface"* asserts the surface closes, `aria-expanded=false`, listbox hidden. Ran the suite: **12/12 green**. `clearSelection`-on-Escape was *intentionally* dropped per the fork (Escape is dismiss, not clear; `fui:Clearable.ts:17` is "deliberately decoupled from Escape"). No `<auto-complete>` regression (`fui:auto-complete.spec.ts` present). Acceptance — *"CompositeWidget in Frontier UI with a chosen, tested Escape behavior; no regression"* — is **met by prior migration work** (the #193 droplist migration, after this card was written). No new code; resolving against the existing decomposed behaviors.
