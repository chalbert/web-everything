---
bornAs: xh3e97s
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/review-set-label.mjs", "we:scripts/conveyor/delegation-trial-gate.mjs", "we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Delegation trial logging stops once a triple graduates and never records a miss — computed demotion is unreachable at spot-check

Found by the #3867 prep skeptic. we:scripts/review-set-label.mjs:1030 logs a session-delegation trial only while !isDelegationTripleGraduated(...), and always writes outcome 'landed' with findings null. So once a triple graduates no further rows are written, and no row ever records a miss: rule 6 of #delegation-trial-record-graduation (demotion is computed from the record and immediate) cannot fire at spot-check. Separately, we:scripts/conveyor/delegation-trial-gate.mjs:15 infers informative from free-text findings (rule 4 requires the separate informative field) and :23 hard-codes streak >= 5 instead of reading DEFAULT_BACKDOWN_THRESHOLDS.minCleanStreak from we:scripts/lib/provider-routing.mjs (rule 1: every reader of the record uses the same predicates). Fix: keep logging trials for graduated triples, record the review's findings and informative flag on the row, and make the gate read the shared predicates and thresholds. Done when a test shows a graduated triple's later confirmed miss demotes it to full.

## Done when

1. **Executable** — `node --check` passes for `we:scripts/review-set-label.mjs`, `we:scripts/conveyor/delegation-trial-gate.mjs`, `we:scripts/lib/provider-routing.mjs`, and every declared file exists on main.
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.
