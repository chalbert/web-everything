---
type: issue
workItem: story
size: 8
status: open
blockedBy: ["635", "636", "649"]
dateOpened: "2026-06-14"
tags: []
---

# Backfill the dual-mode (unplugged + plugged) plug test suite across all plugs

Author the missing automated tests so every plug proves it works in both unplugged (non-invasive, no window/prototype mutation) and plugged modes, satisfying the #606 dual-mode conformance check. Uses the audit matrix to target gaps and the check rule for the required shape. Brings the whole runtime green under the gate — a precondition for trusting the @frontierui/plugs extraction.

## Blocked-by #649 added (2026-06-15, batch pre-flight)

Claimed in a batch and inspected before any edit. This "backfill across **all** plugs" overlaps with
**[#649](/backlog/649-reconcile-plugs-we-fui-drift-dual-mode-test-backfill-ahead-o/)**, which the dual-mode
gate rule itself names as the backfill owner (`validatePlugDualMode` in `scripts/check-standards-rules.mjs`:
*"#649 backfill target"*). #649 reconciles the WE/FUI plug **drift** (porting WE-ahead canonical fixes into
FUI, deciding the two WE-only domains' home) **and** backfills the 3 highest-impact domains' dual-mode tests —
and it is `blockedBy #170` (the reversal). Backfilling all plugs **now**, against the current divergent
`webeverything/plugs/` tree, would write tests twice (or against a copy #170/#658 is about to move/delete).
So this item depends on the reconciliation landing first: `blockedBy #649` added. Once #649 reconciles the
trees + backfills the highest-impact set, #637 is the **remaining** domains' backfill, after which
`PLUG_UNPLUGGED_TEST_ENFORCED` flips to `true` (the #636 gate-promotion noted in #649). Not a design call —
a factual DAG correction grounded in the #635 audit + the gate rule's own owner designation. Released to the
pool unworked.
