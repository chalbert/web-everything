---
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/rearm-review.mjs", "we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/__tests__/rearm-review.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Keep the review across a CI heal that leaves the PR own change unchanged (#4310 follow-up)

Follow-up from the #4310 ruling (reviews survive a mechanical rebase or fix that leaves the PR own diff unchanged), which listed it but filed no card. Live case PR #3432: after its round-2 acceptance, a CI heal rebased and re-pushed it and the re-arm forced a full round-3 review of an unchanged contribution. Route a provably unchanged CI-heal re-push through the existing restamp proof (decideRestampHumanClearance in we:scripts/review-set-label.mjs) before re-arming, keeping the live-verdict and human-hold safeguards. Replay an unchanged heal, an unreadable proof, and a changed contribution.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
