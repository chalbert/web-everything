---
bornAs: xb9r1hg
kind: task
parent: "2822"
status: resolved
dateOpened: "2026-08-02"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
tags: [conveyor, prevention, independence, orchestrator-mechanization, review]
---

# Land seam refuses a self-cleared verdict, and an invariant anchor must link an enforcer

Nothing today records WHO cleared a verdict or refuses a clear whose reviewer is the author — the independence bar rests on convention, not code. And an operational-invariant anchor can assert a guarantee with no enforcing code path. Two coupled fixes: the clearing actor writes its session/service id into the verdict and the land seam refuses a clear whose reviewer id equals the author's; plus a rule that an operational-invariant anchor must link an enforcing code path or an open item.

## Gap

Two enforcement holes behind the independence guarantee:

1. A cleared verdict carries no reviewer identity, and the land seam does not compare reviewer to author — so an orchestrator wearing a reviewer hat can clear its own work with nothing stopping it.
2. An anchor asserting an *operational invariant* (a runtime guarantee) can exist with no link to the code path that enforces it, so the invariant reads as guaranteed while nothing actually holds it.

## Why it matters

`#fix-review-convergence-independent-root-cause` and `#human-required-is-judgment-only` depend on the clearer being a *distinct* party (the #2398 fresh-context bar). Convention alone can't hold that line under autonomous agents. Writing the clearer's id and refusing a self-clear makes independence a machine fact; requiring invariant anchors to name their enforcer stops "asserted but unenforced" guarantees.

## Mechanical fix

1. The clearing actor writes its **session/service id** into the verdict record.
2. The **land seam refuses** a clear whose reviewer id equals the author's id.
3. Add a rule that an **operational-invariant anchor must link** an enforcing code path or an open item that will build it.

## Provenance

Outstanding prevention **M3** from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Composes with `#agent-convergence-independent-validation` (#2398) and the independence rail (#2439). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
