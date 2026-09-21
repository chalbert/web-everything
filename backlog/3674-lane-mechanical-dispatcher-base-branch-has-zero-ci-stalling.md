---
bornAs: x8ghrih
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/pr-land.mjs", "we:.github/workflows/ci.yml", "we:.github/workflows/review-gate.yml"]
dateOpened: "2026-09-14"
tags: []
---

# lane/mechanical-dispatcher base branch has zero CI, stalling the drain's hardcoded test-check gate forever

Structural bug found 2026-09-14 while draining PRs targeting `lane/mechanical-dispatcher`: this base branch has ZERO CI configured. GitHub branch protection returns 404 (no protection rule exists), and both we:.github/workflows/ci.yml and we:.github/workflows/review-gate.yml hardcode `pull_request: branches: [main]` as their only trigger, so no check-run has EVER executed against any commit on this base (confirmed via `commits/{sha}/check-runs` returning `total_count: 0` for commits on this branch).

Real impact: we:scripts/merge-ai-prs.mjs (the drain) hardcodes `requiredCheck = 'test'` and refuses to land any PR on this base until that check reports SUCCESS, a condition that can never be satisfied, since `test` never runs here. This silently stalls every PR targeting this base indefinitely, with no error: the PR just sits labeled `checking` forever, even after independent review (`review:accepted`) has already landed. By contrast we:scripts/pr-land.mjs's own gate is NOT broken this way, it correctly reads the branch's actual required-check contexts via the GitHub API and treats zero-required-checks as "passed"; only the drain's hardcoded, stricter gate disagrees and stalls.

Confirmed hit twice on 2026-09-14: PR #2198 (telemetry fixes) stalled for hours and was eventually landed via the sanctioned WE_MERGE_BREAK_GLASS=1 override, after independent local verification (ran the exact test shard locally: 125/125 passed clean, proving it was never a real failure, CI simply never ran). PR #2156 hit the identical root cause and was confirmed still stuck as of 2026-09-14 (out of scope for the session that found it; flagged only, not resolved). PR #2216 (an agent-memory landing) was suspected of the same symptom and was being checked at time of filing.

This is not a one-off: it will stall every future PR targeting this base branch until fixed. Two candidate fixes to weigh (not deciding here): (a) wire real CI to run against `lane/mechanical-dispatcher` too, mirroring main's workflow triggers in we:.github/workflows/ci.yml and we:.github/workflows/review-gate.yml; or (b) fix we:scripts/merge-ai-prs.mjs's hardcoded `requiredCheck='test'` to match we:scripts/pr-land.mjs's correct behavior, read the branch's actual required-check contexts and treat zero-required-checks as passed, rather than assuming a `test` check always exists.

## Finding (2026-09-21): the fork is now a decision card

The two candidate fixes above, plus a third (neither: no pull requests against the prototype), are filed as decision card xxpu8tm, `relatedTo` this card and #3653. Re-verified today: the branch is still unprotected (404), its tip has 0 check-runs, `we:scripts/merge-ai-prs.mjs` still defaults `requiredCheck = 'test'`, and no pull request has been opened against the base since 2026-09-15 (the operator's ruling made the direct push the delivery path). Do not build either fix before that card is ruled.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
