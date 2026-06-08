---
type: issue
workItem: task
parent: "023"
status: resolved
dateOpened: '2026-06-02'
dateResolved: '2026-06-06'
tags:
  - droplist
  - plateau
  - behaviors
  - refactor
  - traits
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
---

# Collapse composite-widget into a bundle over the split behaviors

> **Resolved 2026-06-06.** Done in Plateau: `src/blocks/attributes/CompositeWidget.ts` is now a thin bundle
> that composes `FocusDelegation` + `Selection` (single source of truth, no duplicated logic); the old
> internals-coupled test was retired and the split is proven by `FocusDelegationSelection.split.test.ts`.
> Original narrative preserved below.

The composite-widget split is prototyped: FocusDelegation.ts + Selection.ts are independent Plateau behaviors coordinating only via DOM (aria-activedescendant/aria-current) + the activedescendantchange event, proven by FocusDelegationSelection.split.test.ts (14 green). Remaining work: make composite-widget a thin bundle that composes the two (single source of truth, no duplicated logic) and retire its old, already-red, internals-coupled test.
