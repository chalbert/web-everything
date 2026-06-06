---
type: issue
status: open
dateOpened: '2026-06-02'
tags:
  - droplist
  - plateau
  - behaviors
  - refactor
  - traits
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
---

# Collapse composite-widget into a bundle over the split behaviors

The composite-widget split is prototyped: FocusDelegation.ts + Selection.ts are independent Plateau behaviors coordinating only via DOM (aria-activedescendant/aria-current) + the activedescendantchange event, proven by FocusDelegationSelection.split.test.ts (14 green). Remaining work: make composite-widget a thin bundle that composes the two (single source of truth, no duplicated logic) and retire its old, already-red, internals-coupled test.
