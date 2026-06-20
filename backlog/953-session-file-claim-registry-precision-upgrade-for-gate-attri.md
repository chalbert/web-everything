---
kind: story
size: 3
status: parked
dateOpened: "2026-06-18"
tags: []
---

# Session file-claim registry — precision upgrade for gate attribution if claim-baseline leak bites

Fork 2-C from #949 (deferred precision upgrade, not the default). If the claim-time git-baseline snapshot (#952, Fork 2-A) proves too leaky — specifically the fail-unsafe overlap where a file already dirty at my claim that I then also edit gets mis-attributed as foreign and stepped over — extend we:reservations.json (already session-keyed, TTL-pruned) to record each edited file against the session via a PostToolUse hook on Edit/Write. Most precise (no snapshot-diff race) but adds hook infrastructure + orphan-claim cleanup on a dead session (mitigated by the existing TTL prune). Only build if the baseline approach's residual actually bites.

## Parked 2026-06-18 (batch-2026-06-18)

Trigger condition has not fired: the #952 claim-time git-baseline is freshly shipped and there is no observed mis-attribution leak yet. Building this now would be speculative precision the residual doesn't (yet) warrant. Unpark only when the baseline approach demonstrably mis-attributes a dirty-then-edited file (`feedback_gate_red_stop_scoped_to_own_work` territory).
