---
kind: story
size: 5
status: open
blockedBy: ["1423"]
dateOpened: "2026-06-21"
tags: []
---

# bulk-action intent + FUI behavior block — fan-out a command across an N-item selection (scope: visible|matching, count-announce, partial-failure outcome)

Realizing build for the #1423 placement ruling: author the bulk-action intent JSON (scope: visible|matching default visible; the fan-out + N-selected aria-live count + post-action focus-return contract; the per-target partial-failure outcome) composing selection + command over a target set, plus the FUI behavior block that realizes it (consumes existing SelectionBehavior + the #1409 toolbar bar, binds the bar to the live selection set) and a demo (selectable list with contextual action bar). File via /new-standard. Apply/rollback mechanics delegate to a future #1395-style optimistic-mutation home; bulk-action only names the partial-failure contract.
