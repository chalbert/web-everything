---
bornAs: xwn6th5
kind: story
size: 2
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "72479ddbb0cb6ceb43b318462a357703916509ab"
tags: []
---

# pr-limit: authorship cache must invalidate when the PR base changes

Follow-up from the #3215 advisory (2026-10-02). In `we:scripts/lib/pr-limit.mjs`, `countOpenPrsForRepo` caches authorship by repository, PR number, and head OID. Retargeting a PR without changing its head can change its commit range while retaining the old verdict. Include the observed base branch name in cache identity so retargeting triggers recomputation.

## Progress

- Original premise/scope: the advisory cited `we:scripts/lib/pr-limit.mjs:194` as a head-only cache and scoped the fix to `we:scripts/lib/pr-limit.mjs` plus `we:scripts/lib/__tests__/pr-limit.test.mjs`.
- Verified/corrected premise: the relevant source is `countOpenPrsForRepo` in `we:scripts/lib/pr-limit.mjs`; its key already includes repository and PR number as well as head OID, but omits the base. Use symbol references instead of the stale line citation. Both shared and direct reads in `fetchOpenPrs` already request `baseRefName`, and `fetchPrCommits` already forwards it to the git reader. No additional query field or source file is needed. The original two-file scope, including its matching existing test file, remains sufficient.
- Source evidence: `readGitPrCommits` in `we:scripts/lib/git-pr-commits.mjs` declines non-main bases; `meteredPrCommits` in `we:scripts/lib/gh-metered-reads.mjs` then reads the PR's current commits without another authorship cache. Existing bounded-count tests in `we:scripts/lib/__tests__/pr-limit.test.mjs` cover head changes, persistence, pruning, and API budgets, but not base changes.
- Observed preparation probe: called `countOpenPrsForRepo` with injected PR rows, an in-memory cache, and GraphQL responses. Holding repository, PR number, and head fixed, changed the base from `lane/base-a` (AI commit) to `lane/base-b` (human commit). Counts were 1 before, 1 after with cache, and 0 after without cache; only the initial and uncached calls read commits. This reproduces the defect without live GitHub mutation. The goal is not already delivered.

## Design

In `we:scripts/lib/pr-limit.mjs`, form a versioned, unambiguously encoded cache key from repository slug, PR number, head OID, and nonempty `baseRefName` (for example a version prefix plus a JSON-encoded tuple). Require both head OID and base name before reading or writing a cached verdict. Missing identity still permits normal commit lookup and counting; it only disables verdict reuse.

Use the same key for cache lookup, storage, and `liveKeys` pruning. Legacy head-only keys must miss and be removed by the existing flush mechanism; do not migrate their verdicts into a base-specific entry. Cache both true and false verdicts, and never cache an unresolved read. Update the head-only immutability/key comments in `we:scripts/lib/pr-limit.mjs` to describe retarget-aware reuse.

This fixes base-branch retargeting once the PR snapshot observes the changed name. Preserve existing local-first reads, bounded API fallback, accepted-review exclusion, and fail-soft counting behavior. Advancing the tip of the same base branch and snapshot freshness are separate concerns; this change does not promise invalidation on those events.

## MVP

1. Implement the base-aware key and missing-identity bypass inside `countOpenPrsForRepo` in `we:scripts/lib/pr-limit.mjs`; update its cache documentation.
2. Extend the existing bounded-count harness in `we:scripts/lib/__tests__/pr-limit.test.mjs` so commit responses can change when the PR is retargeted, and add the regression cases below.
3. Deliver the source and matching tests together. No caller API, cache path, limit, exemption, or authorship-classifier policy change is required.

## Test plan

All added cases belong in `we:scripts/lib/__tests__/pr-limit.test.mjs`:

- With the same repository, PR number, and head, change between two non-main bases and change commits from AI to human. Assert a new commit read, count 1 → 0, and zero unresolved PRs. Repeat human → AI to prove false verdicts also invalidate.
- Keep the complete identity unchanged on a subsequent call: assert zero additional reads and reuse of either boolean verdict. Retain the existing head-change test.
- Retarget with local-only mode or an exhausted API budget: assert unresolved increases instead of returning the old verdict. Permit a later read and assert recomputation; preserve the dispatch fallback's API cap.
- Omit or empty the base name: assert a stale cached verdict cannot be reused and a successful read does not create an incomplete-identity entry. Preserve the existing behavior for missing head OID.
- Seed a legacy head-only key in a temporary file, then perform a count: assert a fresh lookup, persistence under the new identity, legacy-key pruning, and reuse after reloading the cache. Retarget again and verify the previous base's entry is pruned.
- Retain accepted-review exclusion, corrupt-cache handling, and existing budget/convergence coverage.

## Proof plan

Run the focused retarget regression against the pre-fix source and retain its failure: the cached count remains unchanged and no new commit read occurs. With the fix applied, run the complete suite in `we:scripts/lib/__tests__/pr-limit.test.mjs` using Vitest and retain the passing counts and call assertions. Run `npm run check:standards` after implementation. These are delivery checks; the preparation probe above is evidence of the current defect, not evidence of a fix.

Use injected shared rows and GraphQL results for deterministic retargeting and a temporary cache file for the persistence check. This exercises the actual counting and cache functions without retargeting a real PR or spending GitHub calls.

## Done when

1. **Executable** — from the WE checkout, run Vitest on `we:scripts/lib/__tests__/pr-limit.test.mjs` (remove the repository locator prefix when supplying the filesystem argument). The new retarget tests fail on the old source and pass on the implementation; the whole file remains green.
2. A changed observed base with an unchanged head never reuses either the old true or false authorship verdict. Unavailable commit reads remain unresolved and are not cached.
3. Unchanged complete identities retain cache hits, legacy entries cannot supply verdicts, and API budgets and existing counting policy remain intact.

## Follow-ups

No additional work is required to deliver this retargeting fix. Same-name base-tip movement, host-shared snapshot freshness, and cross-repository cache-pruning behavior are outside this card's scope; evaluate them separately if broader commit-range freshness is pursued.
