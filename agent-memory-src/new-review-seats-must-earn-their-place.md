---
name: new-review-seats-must-earn-their-place
description: New reviewer/judge seats (new models, new lenses, new agents) must prove marginal value on a validation batch before becoming a permanent default-panel seat — never added just because they might add an angle.
metadata:
  type: feedback
---

Adding a new judge/reviewer seat to the default review panel is not free just because it
might catch something a different angle would miss — it's a permanent multiplier on
cost and latency for every future PR, forever. "It might help" is not sufficient
justification for a permanent seat.

**Why:** surfaced while validating the new Codex correctness-advisory seat (epic #3383,
backlog #3635) — the user pointed out that (a) an additive advisory seat improves review
quality but does nothing for the separate goal of reducing Claude token usage, and
(b) as more models/agents get introduced over time, we cannot expect to run them all on
every PR just because each one could plausibly bring a new angle. That's an unbounded
scaling cost dressed up as a quality argument.

The user also proposed a cleaner governing principle in the same conversation: require
at least one reviewer to be a different agent/model than whichever agent built the
change (never let a model be the sole reviewer of its own work), rather than trying to
maximize the number of review angles. This scales down naturally — once a non-Claude
agent is doing real delivery work, Claude's existing judges already satisfy this rule
for those PRs, so no additional seat is needed there just to keep adding angles.

**How to apply:**
- Before adding any new seat/agent to a default, always-on pipeline (review panel,
  benchmark panel, etc.), require a validation batch first: real cases plus a known-clean
  control, measuring both catch rate and false-positive rate, weighed against the added
  cost per run.
- Don't conflate "improves quality" with "reduces cost" — they're independent axes, and
  a seat justified on one doesn't automatically justify itself on the other. State which
  axis a proposed addition is actually serving.
- Prefer the minimal structural rule — at least one reviewer differs in agent/model from
  the builder — over maximizing seat count. Re-evaluate whether an additional seat is
  still needed once that minimal condition is already satisfied by a different change
  (e.g. a non-Claude delivery agent already in the loop).
- Once several validated candidate seats exist, prefer scoping them (by risk/blast-radius
  tier, by sampling percentage, by rotation) over running every seat on every case by
  default — mirrors the same blacklist-first / tiered-leniency thinking already applied
  to auto-fix risk gating (#3649 Fork 6, POC vs. main leniency tiers).
