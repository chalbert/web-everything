---
kind: task
status: open
dateOpened: "2026-09-19"
tags: []
---

# we:review-dispatch.mjs: 4 non-blocking follow-up gaps from PR #2313 independent review

Four deferred findings surfaced during the PR #2313 independent review (we:review-dispatch.mjs), filed per reviewer's OWED marker:

1. **Dedupe-key gap in trial logging**: The trial-logging dedupe check (`pr + dispatchKind === 'session-delegation'`) doesn't handle a single PR containing multiple distinct {provider, model, taskType} trials — could under- or over-count in that case.

2. **Hardcoded verifiedBy label**: `verifiedBy: 'independent-claude'` is hardcoded in the auto-log path rather than actually checking whether the review that triggered it was genuinely independent (vs. self-authored/self-dispatched review under standing authorization) — a real trust-labeling gap.

3. **Channel-gate as attribution, not authentication**: The channel-gate check (exact match against `we:REVIEW_PR_CHANNEL`) is attribution only — nothing cryptographically ties a PR body's declared channel to how it was actually processed, so it's trust-on-write, not verify-on-read.

4. **Overly conservative divergence guard**: `we:publishDelegationTrialCommit`'s divergence guard (added to fix a real unscoped-push bug) refuses to log even when local main is merely *behind* origin (not diverged/ahead) — overly conservative; fails safe (refuses rather than ships something bad) but could cause more missed trial logs than necessary.

Reference: PR #2313, 2026-09-19 independent review in we:review-dispatch.mjs. Status: open, not yet prepared/scoped for fixes — candidates for future cleanup, not urgent.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
