---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/main-red-recovery.mjs", "we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# Fix-dispatch daemon must detect + trigger CI for a PR whose required checks never ran

LIVE 2026-09-26: chalbert/web-everything#2729 (#4166) is review:accepted+MERGEABLE but BLOCKED, labelled checking, since its head 19889a0e (last commit 14:20:26Z) never got a test/smoke/daemon-soak run at all -- only 3x review-gate. Confirmed: #2729 opened 14:22:07Z stacked on #2722's branch; #2722 merged 15:13:48Z, firing a base_ref_changed event on #2729 at 15:13:46Z that retargeted its base to main -- a base retarget never triggers a new workflow run, so no CI run was ever queued against this head under the new base (gh run list --commit 19889a0e: empty; gh api commits/.../check-runs: review-gate only). we:scripts/conveyor/main-red-recovery.mjs's isPrCiFailureOwedRerun/planHungCiRecoveries both only reason about a check that already CONCLUDED or is already IN_PROGRESS/QUEUED -- we:scripts/conveyor/main-red-recovery.mjs#buildHungCandidates explicitly skips a PR with zero rollup entries for the CI workflow ('if (!ciChecks.length) continue'). we:scripts/merge-ai-prs.mjs#lifecycleLabelFromCiTruth's checking fallback then keeps lying that CI is merely pending. FIX: a third recovery pass in we:scripts/conveyor/main-red-recovery.mjs + we:scripts/conveyor/ci-red-recovery-watch.mjs, wired into we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#runTickAllRepos (the one daemon confirmed live and ticking, same as its two siblings) that: detects a PR whose head has NO rollup entry at all for any required context (read from branch protection's required_status_checks.contexts, never hardcoded) for at least a threshold (10min default) since its head commit; prefers PUT /pulls/{n}/update-branch when the PR is behind main (also merges main in); otherwise gh workflow run on the PR's own branch; caps retries per head sha via a durable PR-comment marker mirroring the existing hung-run/main-red caps; logs every action; clears the stale checking label only for this pass's own narrow true-positive (zero required-check rollup entries at all), never touching the ratified 4-state taxonomy itself.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
