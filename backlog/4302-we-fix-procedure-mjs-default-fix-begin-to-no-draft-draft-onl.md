---
bornAs: xyfvtfz
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/fix-procedure.mjs", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:skills-src/finish/SKILL.md", "we:skills-src/mechanical-delivery-doctrine/SKILL.md", "we:scripts/conveyor/review-status-tag.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# we:fix-procedure.mjs: default fix-begin to no-draft; draft only for scope-change/withdrawn

Operator ruling 2026-09-27 (live incident chalbert/web-everything PR #2811, codified we:docs/agent/platform-decisions.md#fix-claim-draft-only-on-withdrawal): a fix claim (we:scripts/conveyor/fix-procedure.mjs, shipping via PR #2821/lane/fix-procedure, not yet merged at filing time) must NOT convert the PR to draft on every fix-begin. Normal repair loops (a fixer addressing review changes, a ci-heal repairing red CI, a mechanical conflict repair, a mechanical rebase/CI-rerun) stay ready-for-review by default; the fix claim's own reconcile refusal + push refusal already hold the lock, and we:scripts/merge-ai-prs.mjs's decideReviewGate/acceptanceCoversHead already re-verifies the accepted sha independently of the label at merge time, so draft was never load-bearing for merge safety. Draft is owed ONLY for two explicit, stated reasons on the SAME fix-begin call: scope-change (a scope-change request reaches the worker mid-review) or withdrawn (review finds the PR does not do what the card asked at all — a fundamental miss). Needed: (1) fix-begin gains --draft --reason=scope-change|withdrawn, defaulting to no --draft at all; (2) two new mutually-exclusive review-status labels, review-status:draft-scope-change / review-status:draft-withdrawn, named at fix-begin time (mirrors we:scripts/conveyor/review-status-tag.mjs's existing STATUS_LABEL_RE convention — this session already added review-status:fixing-conflict there as the closest existing precedent to extend); (3) update we:skills-src/conveyor/fix-agent-brief.md, we:skills-src/conveyor/fix-agent-ci-brief.md, we:skills-src/finish/SKILL.md, and we:skills-src/mechanical-delivery-doctrine/SKILL.md rule 13 to state the new default; (4) tests pinning the new default (no draft) and both explicit-reason paths, plus a soak scenario replaying #2811's own shape. Not done in this session's own lane/promote-stale-green because we:scripts/conveyor/fix-procedure.mjs lives only on the unmerged lane/fix-procedure (#2821) branch — forking it from a main-based lane here would duplicate/conflict with that PR's own landing; this card is the tracked follow-up to apply once #2821 lands (or as a commit on top of it).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
