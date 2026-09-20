---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/operations/load-review.mjs", "we:scripts/operations/load-report-cli.mjs", "we:scripts/lib/lane-concurrency.mjs", "we:scripts/readiness/heavy-admission.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Set concurrency limits from host-sampler data: dated checkpoint, weekly review, change log

GOAL (operator, 2026-09-20): set the lane cap, worker cap, heavy-command admission size and session count from measured host load, not guesses. The sampler (we:scripts/operations/host-sampler.mjs) has run since 2026-09-20 13:06 EDT and the analysis exists (we:scripts/operations/load-report-cli.mjs, we:scripts/operations/load-review.mjs with suggestLimits and resourceReviewOwed) but nothing schedules the review, nothing decides who may change a limit, and the goal lives only in a tracker note. DESIGN TO SETTLE BEFORE BUILD (strong design required; file cleared only after a design review): (1) METHOD: p90 load1 at or below the core count, probe p90 under the stated bounds (spawn 250 ms, spin 25 ms), heavy-admission size as the driver rather than lane count, at least 48 h of samples including one busy window (coverage.sufficient). (2) TRIGGER: how a review comes due without a person remembering: resourceReviewOwed must become a queued item automatically (same rule as the wip Attention change) or a scheduled routine; first checkpoint 2026-09-22 about 13:06 EDT, then weekly. (3) AUTHORITY: an agent may PROPOSE via suggestLimits; only the operator applies a change, and every change is recorded with record-limit-change. (4) ROLLBACK: after a change, the next review compares before and after; a worse saturation share or probe p90 reverts it. (5) SCOPE: which limits are in scope (we:scripts/lib/lane-concurrency.mjs, the land-advance worker cap, we:scripts/readiness/heavy-admission.mjs, session count) and who owns each. ACCEPTANCE: an executable check exits non-zero when a review is overdue; the first review is recorded; a limit change is logged with before and after numbers.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
