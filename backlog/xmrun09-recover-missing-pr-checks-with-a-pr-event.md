---
kind: story
status: active
size: 3
dateOpened: "2026-09-30"
tags: [conveyor, ci, reliability]
---

# Recover missing PR checks with a PR event

Replace the ineffective workflow-dispatch recovery in we:scripts/conveyor/ci-red-recovery-watch.mjs with an exact-head, credential-pinned push. Keep required checks unchanged. The implementation is awaiting human review and deployment; no live recovery push was authorized in this working session.

## Observed cause

Read-only GitHub probes on 2026-10-01 UTC found PR #3209 at `1f7481b9bccf75ae1c37ed5705ec2ab57d77a9c7`, OPEN, CONFLICTING, with an empty statusCheckRollup. Push event `45093099825` attributes that head's push to **chalbert** at 00:51:03Z, not github-actions[bot]. Its commit timestamp was 00:40:48Z: the ten-minute commit-age threshold could fire immediately after the actual push. Commit author/committer metadata (`test`) is not the pushing identity. The precise historical access token is not exposed by this event; current git configuration uses the gh credential helper. There is no evidence that this push used the default GITHUB_TOKEN. The fixer launcher also strips daemon token snapshots before starting workers in we:scripts/operations/dispatch-lane-io.mjs.

At push time, main was `9b5d07ade087cc509a3f5d853fbf76b0c14acea4` (confirmed by the main PushEvent at 00:50:16Z). A real `git merge-tree --write-tree` probe against that main and the incident head exited 1 with a content conflict in we:scripts/operations/__tests__/probation-build-run.test.mjs. Thus the head was already conflicting when pushed; GitHub suppresses pull_request workflows for merge conflicts. The recovery candidate filter excluded CONFLICTING but admitted UNKNOWN; the exact mergeability value used by the historical daemon tick was not logged, so UNKNOWN is a plausible route through the guard, not a proven historical reading.

Runs [36798230915](https://github.com/chalbert/web-everything/actions/runs/36798230915) (cancelled) and [36798584088](https://github.com/chalbert/web-everything/actions/runs/36798584088) (success) both used workflow_dispatch, actor web-everything[bot], the exact incident SHA, and explicitly included PR #3209 in their pull_requests arrays. Association was present. However, [GitHub's required-check documentation](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated) excludes workflow_dispatch job checks from PR evaluation. A successful dispatch therefore cannot repair the rollup.

we:.github/workflows/ci.yml triggers on push to main, pull_request against main, and workflow_dispatch. Live main protection requires GitHub Actions contexts test, smoke, daemon-soak, and soak-replay-gate. No protection or workflow gate was weakened.

The read-only fix-dispatch log contained **33 recovery lines across 15 PRs / 19 distinct PR-head pairs**, and **127 cap-refusal lines across 10 PRs / 12 pairs**. Repeated refusals are ticks, not separate incidents. PR #3209 had four dispatch attempts across two heads and five cap-refusal lines.

## Recovery contract

we:scripts/conveyor/missing-run-push.mjs re-reads the exact open PR, requires a same-repository lane targeting main and confirmed mergeability, and checks fixer claims before preparing and immediately before pushing. It creates an unchanged-tree commit in a temporary bare repository, pins an explicitly recognized PAT/user OAuth or token-bound conveyor App credential, and pushes with the observed SHA as an exact lease. It never checks out or edits a daemon clone. A marked recovery tip cannot generate another recovery commit. Old dispatch comments do not exhaust the corrected method's retry budget. Deferred preconditions do not consume attempts or change labels. A submitted push is logged as a request, not proof that checks started.

## Validation

A read-only invocation of the new recovery preflight against live PR #3209 returned `ok: false`, `deferred: true`, and `PR has merge conflicts; conflict repair must run first`. The probe runner permitted only the exact GitHub GET for PR #3209 and rejected every other command, making a live write impossible. Historical merge-tree reproduction and live API evidence above establish the incident cause; they do not establish that the new push path has run in production.

The required lane verification (we:scripts/verify-lane.mjs) selected 94 test files: 4,326 tests passed, including all 199 tests across the three recovery suites. Three existing real-process tests in we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs failed because this execution sandbox denies `/bin/ps` (`Operation not permitted`, reproduced directly). The gate remains red; no test was skipped or weakened. The separate `npm run check:standards` run passed with zero errors. Re-run the unmodified gate in an environment that permits process-table reads. The new recovery suite also exercises real git fetch/commit-tree plumbing against a temporary local fixture, intercepting the final push; its source ref remains unchanged.

## Follow-ups

- After review and deployment, observe a recovery's new head receiving pull_request CI and all required contexts. This session must not commit, push, open a PR, or mutate a live PR, so successful live recovery remains unproven. The incident itself requires conflict repair first; an empty commit cannot repair its content conflict.
- The observed successful dispatch had no soak-replay-gate job, while live protection required it and this checkout's CI file did not define it. Investigate that separately without removing the required context.
- Use push/event time rather than commit authoring time if immediate post-push recovery remains noisy; retain the exact-head and mergeability preflight regardless.
