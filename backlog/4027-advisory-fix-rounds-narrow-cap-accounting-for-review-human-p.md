---
bornAs: xkmu3gv
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/advisory-round-count.mjs", "we:scripts/conveyor/advisory-fix-round-count.mjs", "we:scripts/conveyor/conflict-fix-round-count.mjs", "we:scripts/conveyor/rearm-review.mjs", "we:skills-src/conveyor/fix-agent-brief.md", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Advisory fix rounds + narrow cap accounting for review:human PRs

Two we:scripts/conveyor/reconcile-core.mjs improvements under epic #3383, live case chalbert/web-everything#2549 (review:human, advisory:changes, merge-status:conflicting, review-round:5, 5/5 negotiation-cap rounds already spent). (1) ADVISORY FIX ROUNDS: today the reconcile pass only ever dispatches review for a needs-human phase PR, never a fix, even when the PR already carries advisory:changes (a real admitted finding from we:scripts/operations/review-pr.mjs's advise step). No daemon acts on it. Add: a needs-human PR carrying advisory:changes, not yet fixed for the CURRENT advisory finding, owes a fix; the fixer addresses the advisory finding only, posts before/after evidence, never touches review:human, never records a verdict, then the pass owes a fresh review (re-runs advise) rather than another fix for the same finding. (2) CAP ACCOUNTING: NEGOTIATION_ROUND_CAP (5) is shared by ordinary review<->fix ping-pong and, via countAdvisoryComments, the needs-human/advisory population, so a PR that already spent its 5 rounds on real negotiation (like #2549) can never get an advisory fix OR the mechanical conflict-resolution fix that origin/lane/4026-review-human-statute-fixer (PR #2577) newly routes to the fixer. Mirror the already-landed we:scripts/conveyor/reconcile-core.mjs#CI_HEAL_ROUND_CAP pattern: two new, separate, smaller caps (3 each), one for conflict-resolution rounds (bounced + merge-status:conflicting, the population we:scripts/conveyor/reconcile-fix-dispatch.mjs's own isConflict flag already identifies) and one for advisory-fix rounds (needs-human + advisory:changes), each counted from its own new durable marker comment, never the shared rearm/advisory counters. The ordinary cap and every other PR population is unchanged. Update we:skills-src/conveyor/fix-agent-brief.md with an advisory-fix mode section.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
