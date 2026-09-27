---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# HIGH: waiting-on-system-fix ci-heal escalation never expires once the referenced fix lands

HIGH — can suppress healing forever. Still-open Codex advisory finding from chalbert/web-everything#2787's FINAL review round (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: in we:scripts/conveyor/reconcile-core.mjs's ci-red branch, latestCiHealEscalationForHead(pr?.comments, base.headRefOid) finds the escalation matching the CURRENT head and, when escalation.outcome is waiting-on-system-fix, refuses further ci-heal dispatch for that PR/head indefinitely ("nothing further is owed until that fix lands or a new push changes this head"). The refusal check only compares the escalation's recorded head against the PR's current head — it never checks whether the named systemFixRef PR has since merged. So once the referenced system fix actually lands and CI reruns on the SAME PR head (no new push), a genuine remaining failure on that head stays permanently suppressed: nothing re-arms healing until someone notices the stale escalation or a completely unrelated push happens to move the head.

EVIDENCE: read the ci-red escalation branch directly off origin/main in we:scripts/conveyor/reconcile-core.mjs — the refusal is still keyed purely on latestCiHealEscalationForHead's head match; grepped the whole file for systemFixMerged/systemFixLanded or any read of the referenced fix PR's own state — none exists.

PREVENTION (from the reviewer, still owed): add a deterministic reconciliation test covering an open-to-merged system-fix transition with the target PR's head unchanged and CI still failing, asserting healing re-arms once the referenced fix lands (e.g. by checking the systemFixRef PR's own merged state before honoring the escalation).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
