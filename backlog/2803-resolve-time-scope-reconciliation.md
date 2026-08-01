---
bornAs: xbgtqkm
kind: story
size: 5
parent: "2804"
status: open
dateOpened: "2026-08-01"
blockedBy: ["2802"]
tags: [plateau-loop, conveyor, ui-fidelity, we, slice-uifg]
---

# Resolve-time scope reconciliation

At resolve, diff declared scope against actually-changed files; an under-scoped item that touched a presentation/route-graph surface it did not declare is a hard error. Closes the self-declared-scope master bypass with the scope-lease coversFile lock.
