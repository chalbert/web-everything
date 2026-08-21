---
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# mutation-check operation — prove a guard fails when its bug returns

Three vacuous tests reached a paid juror in one session (PR #1503 rounds 1, 2, 3), each a guard that could not fail: one returned early when the corpus lacked hash ids, one compared the live corpus against itself. Each time the fix was the same hand-rolled procedure — patch the impl, run the guard, assert it FAILS, restore — done as ad-hoc python heredocs with no record. Declare it: required input (the mutant), three-valued outcome (killed / survived / unrun), and survived is BLOCKING. unrun is never folded into killed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
