---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["607", "612", "613"]
dateOpened: "2026-06-14"
tags: []
---

# Run the backlog-health audit preemptively on all open stories (pre-flight conformance gate)

Once the retrospective sweep ([#607](/backlog/607-audit-all-resolved-backlog-items-against-the-guiding-princip/))
has hardened the audit, run it **forward** on the OPEN pool so an item must pass **guiding-principle
conformance** — not just tier + size + `blockedBy` — before it counts as batchable. Wire it as a standing
pre-flight + `check`, with **auto-prepare remediation** and **escalate-only-the-residual**.

## Why split from #607

Same apparatus, opposite direction and opposite outcome:

- **#607 (retrospective):** resolved items; observe-only; output a ledger; slip/pre-rule/drift tagging matters
  because the rules postdate much of the work.
- **#608 (preemptive):** open items; **remediation is allowed and expected** (the work hasn't shipped, so
  fixing the card is free and correct); the goal is to *prevent* the next slip, not catalogue past ones.

Splitting keeps the retrospective's "no edits" guarantee clean (per bias-to-separation) — a forward run that
edits cards must not be confused with the backward run that never does.

## What it does (the remediation flow we agreed)

For each open item, run the deterministic sweep + judgment layer (catalog A–E), then:

1. **flag** anything below DoR / principle conformance;
2. **auto-remediate, agent-work only** — execution card: refresh stale `file:line` refs against the live tree,
   lift prose prereqs into `blockedBy`, correct false premises, classify the layer; decision/fork below DoR:
   run `/prepare`. If remediation *uncovers* an unratified premise or genuine fork → carve it as a `type:
   decision` **at DoR** and park the dependent behind it (the #606 pattern);
3. **re-check** batchable / DoR;
4. **escalate to the human ONLY** the irreducible residual — genuine forks now **ready-to-ratify** (quick
   nods, not cold research) + the truly unfixable. Never a raw mess.

**Boundaries:** prepare/remediate **brings to DoR, never decides or ratifies** — genuine rulings still go to
the human, just pre-digested. Remediation **never force-fixes** a card into batchability by quietly making a
design call (that is exactly the failure #607 exists to catch).

## Acceptance

- The deterministic + judgment audit runs over the full open pool; every flagged item is either remediated to
  DoR or escalated as a ready-to-ratify residual.
- A standing hook so `/batch` pre-flight and `/check` apply principle conformance, not just mechanics
  (folds into [backlog-workflow.md](/docs/agent/backlog-workflow.md) selection + the batch skill).
- D3-class readiness honored: an open build whose `relatedProject` is still `concept` is flagged as
  not-truly-ready (the project must exist first).

Blocked on #607 (the audit must be hardened on resolved items before it gates live work).
