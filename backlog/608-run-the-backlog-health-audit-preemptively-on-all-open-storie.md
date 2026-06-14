---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["607", "612", "613"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
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

## Progress

- **Status:** resolved 2026-06-14. All three acceptance criteria met.
- **Forward sweep over the open pool** — deterministic (`check:health`) + judgment fan-out (7 subagents
  over the 37 batchable Tier-A items + 5 Tier-B decisions, clustered by subsystem) against catalog A–E +
  DoR. Result: **9 pure-agent remediations applied** (#595, #611, #481, #487, #513, #504, #134, #086,
  #100); **10 exercise-app phase edges cleared on verification** (loop-managed convention — every resolved
  sibling is `blockedBy`-free, so lifting them would be a quiet design call); **zero genuine new forks**.
  Ledger: [`audits/608-remediation-ledger.md`](../audits/608-remediation-ledger.md).
- **Standing forward gate** — D3-readiness is now automatic in the loader (`src/_data/backlog.js`:
  `projectPending` demotes open builds behind a no-surface `concept` project out of Tier A; holds #604/#170
  on `webplugs`); `npm run check:health` added; surfaced in `check:readiness --select` (*"Held — project
  pending"*) and `check:standards` (aggregate warning); documented in
  [backlog-workflow.md](../docs/agent/backlog-workflow.md) → *Principle-conformance pre-flight* (the
  three-layer gate + remediate-don't-escalate flow) and cross-ref'd from the batch skill.
- **Residual escalation** — only the 3 soft nods already inside prepared decisions (#606 timing, #564 F2,
  #584 F3); they ratify through the normal decision path, unchanged.
- **Gate:** `check:standards` 0 errors; 183 backlog/readiness unit tests pass; 11ty build smoke clean.
- **Leftover filed:** #621 (regression test for the D3-readiness loader rule).
