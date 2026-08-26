---
bornAs: xdrbnkb
kind: decision
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Should a sampling floor be restored over auto-landed PRs

#2631 dropped the random review sampler on the finding that random sampling had no value — measured against a reviewer whose precision we cannot now state. That leaves nothing verifying the 22.5% of merges that reach no reviewer, and it is the only route by which seeded-defect recall becomes a real number. Ruling this reverses a ratified decision.

## Not a fork — a validation gate

There is no rival branch. This is a one-sided go/no-go on a candidate that was deliberately removed, which is the **validation-gate** archetype: digest + verdict, prior-art delta, why-not-a-fork, and a concrete un-gate trigger.

## Verdict: **not yet** — with a concrete trigger

**Prior-art delta.** #xlno40g dropped the random ~1-in-10 sampler on the finding that *"random sampling has no value"* (`we:scripts/lib/review-escalation.mjs:588`). That was measured against a reviewer whose precision **we still cannot state** — the corpus gives a relative comparison, never an absolute rate, because its labels are reviewer-confirmed rather than adjudicated.

So the original ruling is not wrong; it is **unfalsifiable on current instrumentation**. Restoring the floor now would re-run the same experiment with the same missing measurement.

**Why it matters that it stays open.** Nothing verifies the ~22.5% of merges that reach no reviewer at all. It is also the only route by which seeded-defect recall becomes a real number, because a sampled PR is the first review the author did not originate and cannot see coming.

**The trigger, concretely:** re-open when **#3315** (the per-category effective-false-positive meter) can state an adjudicated precision figure for the reviewer. At that point the #xlno40g experiment is repeatable with the measurement it lacked. #3315 is itself blocked on the verdict ledger (#3007 / #3255).

**Skeptic:** SURVIVES. Attacked as "not-yet is a soft park in disguise (#1620)". It is not: the trigger names a specific item whose completion is observable, not a vibe about maturity. But the attack lands on one point — if #3315 stays blocked indefinitely, this becomes a park by attrition, so the dependency is stated here rather than left implicit.
