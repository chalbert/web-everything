---
name: feedback_remediate_before_escalate
description: "For any sub-par/below-DoR card, run a prepare/remediation pass BEFORE asking the user; escalate only the irreducible residual"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22d8eb6a-902b-43d8-a018-6348ed763709
---

When a backlog card fails the DoR / guiding-principle bar, do **not** bring the user the raw problem and
ask what to do. First run an **agent-only remediation pass**: for an execution card, fix-on-the-spot
(refresh stale `file:line` refs against the live tree, lift prose prereqs into `blockedBy`, correct false
premises, classify the layer); for a decision/fork below DoR, run `/prepare`. Re-check, then **escalate to
the user ONLY the irreducible residual** — genuine forks now *ready-to-ratify* (quick nods, not cold
research) + the truly unfixable.

**Why:** the user wants their attention spent only on real human-judgment calls, never on grunt-work
(research, authoring, ref-chasing) an agent can do. "Don't ask me" kills the labor asks, not the final ruling.

**How to apply:** prepare/remediate **brings to DoR, never decides or ratifies** — genuine rulings still go
to the user, just pre-digested (the #606 pattern: prepared, not ruled). Remediation must **never force-fix** a
card into batchability by quietly making a design call — that reintroduces the exact ungoverned-decision
failure the audit exists to catch. Also: DoR/"batchable" is mechanical (tier+size+blockers); it does **not**
verify principle-conformance — screen for that too. Codified in audit items #607 (retrospective) / #608
(preemptive). See [[feedback_prepared_means_dor_not_ratified_directly]], [[feedback_decisions_are_workitems_not_plan_mode]].
