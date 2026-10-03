---
bornAs: x1jbzem
kind: story
size: 5
status: open
scope: ["we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Live course-correction: a user or supervisor can redirect or stop an ongoing agent session

Operator, 2026-10-01: "eventually we will allow user or automated supervisor to redirect and course-correct ongoing sessions." Live case: the fix-3311 session kept fixing parts of PR #3311 the operator had decided to split out; the orchestrator relayed the decision by cross-session message. Make this a first-class product capability: a sanctioned "redirect" action (who, why, new instruction, recorded durably on the PR/run) that a running fixer/builder/heal session receives at its next step and must acknowledge (comply, or stop and report why), with a "stop" variant that ends the session cleanly (claim released, partial work saved). Expose it to the operator (Plateau) and to an automated supervisor (e.g. when a newer decision or a scope change lands on the PR). Never usable to grant an approval.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
