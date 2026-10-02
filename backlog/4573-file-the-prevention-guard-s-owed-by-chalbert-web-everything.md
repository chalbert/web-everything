---
bornAs: xc1cqyy
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "6136132a3af5ca0153dc3bb6299653f0ccb83277"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3044's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the review's prevention debts: fresh-main blocker checks, fail-closed missing/mixed/malformed blocker coverage, a named negative test for each refusal guarantee, and protection against undefined identifiers. Approval did not discharge these debts.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3044@12ea45325ea4c938311740d4c1d7d4f62f42fc4e

## Progress

- **Old premise:** the preflight at we:scripts/operations/probation-build-run.mjs:563–573 needed a fetch and contained an undefined reference. **Corrected evidence:** the current `realIo().openBlockers` is at we:scripts/operations/probation-build-run.mjs:700–713. It resolves cached `origin/main` once, lists that snapshot, and treats missing paths or non-resolved status as blockers. It still does not fetch. Its current filter uses locally bound `id` and `path`; the historical undefined-reference defect is not present in that branch. Static prevention remains owed, not a claim that the current branch still throws that error.
- **Old test citations:** we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:163–164. **Corrected evidence:** the blocker suite now begins at we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:203; it covers an open main blocker despite a local resolution, a resolved blocker, and no blockers. It lacks missing, mixed, malformed, fetch-failure, and stale-remote cases. Its fixture creates a synthetic remote-tracking ref without an origin remote (lines 21–71), so a fetch fix also requires a real temporary origin fixture.
- **Additional premise correction:** we:scripts/backlog/frontmatter.mjs:37 reads a scalar by regex, not YAML validation. A blocker containing `status: resolved` alongside invalid YAML can therefore pass the current check. The existing YAML-only parser in we:scripts/operations/probation-build-run.mjs:193 validates the launch card, but is not applied to fetched blocker cards.
- **Old scope:** the runner plus its isolation and main unit suites. **Corrected scope:** retain those exact source/test entries; refresh main in disposable Git storage, preserving the byte-clean launch-checkout guarantee explicitly tested by `snapshot` in we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:14. The runner source has both matching test files in scope. No shared parser rewrite is needed. The undefined-name gate is already planned by #4550 in we:backlog/4550-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md; coordinate that debt there instead of implementing a second checker here.

The concrete freshness and coverage gaps remain in the current source; this is not already delivered. Research consisted of source/test inspection; no implementation or successful regression run is claimed by this preparation.

## Design

1. Keep `openBlockers(n)` synchronous and returning unresolved IDs. With no blockers, return immediately without network access. With blockers, create a disposable bare Git repository, configure its origin from the launch checkout's origin URL, and perform a bounded `git fetch origin main` there. Resolve relative local origin paths against the launch checkout before passing them to the temporary repository. Use the existing hook-disabled environment, noninteractive Git authentication, a 30-second fetch timeout and forced termination on timeout. Clean temporary storage in `finally`, on success and failure.
2. Capture the fetched main commit once from `FETCH_HEAD` and use that SHA for every tree/status read in that invocation. Never fall back to cached launch-checkout refs after a failed fetch. This satisfies freshness without mutating the launch checkout's refs, objects, index, worktree, or ignored files. Missing origin, fetch failure, timeout, or unreadable fetched tree throws to the existing pre-worker catch in we:scripts/operations/probation-build-run.mjs:621–624: outcome `escalated-needs-human`, executor `none`, no downstream work.
3. Missing blocker cards remain unresolved. Validate each present blocker with the existing YAML-only parser before accepting `status: resolved`; malformed, missing-frontmatter, executable-frontmatter, absent-status, and non-resolved cards remain blockers. Catch parse failures per blocker so diagnostics retain its ID and valid siblings are still evaluated. Retain the existing scalar status reader after validation to avoid broadening status interpretation. Do not change we:scripts/backlog/frontmatter.mjs.
4. Preserve the caller's `blocked` outcome, unresolved-ID detail, executor `none`, and refusal before lane acquisition, claim, worker, and PR operations at we:scripts/operations/probation-build-run.mjs:309–312. A malformed launch card continues through the existing error outcome rather than inventing blocker IDs.
5. For this item's review, require a named regression and a demonstrated failing negative control for each guarantee below. Generic fetch-before-ref lint and a repository-wide review-lens rollout remain separately tracked follow-ups; this item's real-Git tests guard the production branch directly. Verify #4550's planned undefined-name check includes this runner when that guard lands.

## MVP

- Implement the temporary fetch/snapshot and per-blocker YAML validation inside we:scripts/operations/probation-build-run.mjs; retain its public IO shape and current outcome vocabulary.
- Extend the temporary-origin fixture and production preflight cases in we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs. Reuse the fixture for existing open/resolved cases; leave unrelated no-blocker isolation cases network-free.
- Add orchestration tests to we:scripts/operations/__tests__/probation-build-run.test.mjs for nonempty blocker results and preflight exceptions, asserting no acquire/claim/worker/PR calls and no worker-attributed scorecard.
- Include the guarantee-to-test mapping and negative-control observations in delivery evidence. Do not introduce another static-analysis framework or change lane/claim policy.

## Test plan

In we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs, use local temporary bare origins, never production remotes:

- **Freshness:** leave cached main showing a resolved blocker, then commit a reopened blocker to origin only; require `blocked` with its ID. Reverse the transition to prove stale open refs do not falsely block. Assert the launch checkout remains byte-identical, including Git metadata.
- **Missing blocker:** reference an ID absent from fetched main; assert `blocked`, the exact ID, executor `none`, null PR, and no lane/claim/worker/PR calls.
- **Mixed blockers:** combine resolved, open, missing, and malformed cards; require exactly the unresolved IDs, preserving order, with the same no-IO assertions. All-resolved proceeds to the acquisition sentinel.
- **Malformed content:** include invalid YAML that still contains a literal `status: resolved`, no frontmatter, and executable frontmatter with a harmless sentinel; all block and the sentinel never runs. Separately prove malformed launch frontmatter refuses before acquisition.
- **Fetch failure:** configure an unavailable local origin while a cached resolved ref exists; require the existing error outcome, no fallback, and no downstream calls. Exercise the fetch timeout through a controlled subprocess stub, assert bounded termination, and verify temporary-storage cleanup on both success and failure.
- **Controls:** no blockers requires no origin and no fetch; retain the local-resolution-versus-main test, and test relative local origin resolution from the unrelated caller cwd.

In we:scripts/operations/__tests__/probation-build-run.test.mjs, use call spies to verify both refusal paths. A throwing sentinel alone is insufficient evidence for an error-outcome test because unexpected downstream calls can also throw; assert call counts explicitly.

## Proof plan

From the WE root, run focused Vitest for we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs and we:scripts/operations/__tests__/probation-build-run.test.mjs using the repository's heavy-test admission procedure, then run `npm run check:standards`. Record exact executed commands, exit statuses, and test names in delivery evidence. Prefixes identify repositories; remove `we:` when passing paths as command arguments.

Show red/green using disposable source copies: the stale-reopened-origin and malformed-resolved-YAML cases must fail against the current implementation and pass after the fix. Independently remove the missing-path refusal, skip YAML validation, bypass fetch for the cached ref, and bypass the caller's blocker return; require the corresponding named tests to fail for their intended assertions. Preserve working source throughout these mutation probes. Include before/after launch-checkout byte snapshots, explicit downstream call counts, and temporary cleanup assertions. This is proof of prevention, not merely a green happy path.

## Done when

Fresh fetched main governs blocker decisions; missing and malformed cards fail closed with IDs; fetch errors cannot use stale refs or start work; no-blocker dispatch stays network-free; and launch-checkout isolation remains intact. The named production and orchestration regressions pass, their negative controls fail as specified, and `npm run check:standards` passes. Delivery evidence accounts for the shared static-analysis debt through #4550 rather than claiming that debt is already implemented.

## Follow-ups

- #4550 owns the planned runner static undefined-name/use-before-definition gate. Confirm enrollment of we:scripts/operations/probation-build-run.mjs and include an undefined identifier in an unexecuted blocker branch as a negative fixture when delivering that work. This preparation does not claim that gate exists.
- Retain the original broader fetch-before-ref lint proposal as prevention debt: a same-function textual rule would incorrectly reject this disposable snapshot design and shared fetch helpers. A future generalized gate needs data-flow-aware fixtures for both cases before adoption; it is not required for the bounded runtime guard here.
- Retain the original shared review-lens proposal: promote the named-test-per-fail-closed-guarantee checklist into we:docs/agent/delivery-loop.md in a separate scoped change. Apply the checklist concretely to this item's review via Test plan and Proof plan now. No separate cards or shared documents are edited by this preparation.
