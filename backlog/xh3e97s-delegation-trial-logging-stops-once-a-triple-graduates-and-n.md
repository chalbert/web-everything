---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/conveyor/delegation-trial-gate.mjs", "we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Delegation trial logging stops once a triple graduates and never records a miss — computed demotion is unreachable at spot-check

Found by the #3867 prep skeptic. we:scripts/review-set-label.mjs:1030 logs a session-delegation trial only while !isDelegationTripleGraduated(...), and always writes outcome 'landed' with findings null. So once a triple graduates no further rows are written, and no row ever records a miss: rule 6 of #delegation-trial-record-graduation (demotion is computed from the record and immediate) cannot fire at spot-check. Separately, we:scripts/conveyor/delegation-trial-gate.mjs:15 infers informative from free-text findings (rule 4 requires the separate informative field) and :23 hard-codes streak >= 5 instead of reading DEFAULT_BACKDOWN_THRESHOLDS.minCleanStreak from we:scripts/lib/provider-routing.mjs (rule 1: every reader of the record uses the same predicates). Fix: keep logging trials for graduated triples, record the review's findings and informative flag on the row, and make the gate read the shared predicates and thresholds. Done when a test shows a graduated triple's later confirmed miss demotes it to full.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
