---
bornAs: xk7by6p
kind: story
size: 3
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
---

# Planner build: step lanes from the shared pool (plan-step lease, local base, ceiling)

Child 4 of #3922. lane-pool acquire gains a plan-step lease marker with the parent item and a local-source base (fetch the item lane committed tip from its folder, no push). Lane tools that assume item lanes (/finish, stale-claim sweeps, health-stall scan) skip plan-step leases. Step sessions count toward the lane-dispatch ceiling; a build own slot always covers one running step.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
