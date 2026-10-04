---
bornAs: xidr1cl
kind: story
size: 2
status: resolved
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs"]
dateOpened: "2026-10-02"
dateResolved: "2026-10-03"
graduatedTo: f9e1ac7de
tags: []
---

# The drain restores ready-to-merge on an accepted, green, mergeable PR that lost it to a transient park

Live case 2026-10-02: PR #3432 lost ready-to-merge when the drain parked it at 20:02Z during the label flip-flop (fixed by #3590). Afterwards it was review:accepted, every required check green, mergeStateStatus CLEAN, but carried only "checking"; the CI-lifecycle reconciler in we:scripts/merge-ai-prs.mjs deliberately never adds ready-to-merge, and the drain lists only PRs carrying it, so nothing would ever consider the PR again. The operator approved a one-off emergency re-label. Fix: a reconcile step restores ready-to-merge when the PR is review:accepted with no hold label, the required check is green on the current head, and the merge state is clean (the same predicate the merge decision uses), and logs it; a held or red PR never gets it. Replay #3432.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
