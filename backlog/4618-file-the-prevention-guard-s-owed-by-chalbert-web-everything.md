---
bornAs: xau545d
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "15f400ecdda55f99a759cf919567f6a482cfa9a7"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3122's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/lease-reaper.mjs:509-524` — Add one real-git fixture where main advances by an unrelated commit after the lane forks, then the squash lands on the advanced tip, expecting `true`. As a general guard, review lens: for any code choosing between two 'equivalent' revisions, require a fixture where they differ.
2. `we:scripts/conveyor/lease-reaper.mjs:525-526` — Add a deterministic regression test requiring rejection of a multi-commit squash with different Python indentation, and require whitespace-sensitive verification before the aggregate tier returns true.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3122@0d90cc32198e66236ca1d4235754ba45497d7c63

## Progress

Preparation research (2026-10-02; no implementation or stamp):

- **Original premise/scope:** two prevention debts from the accepted review, with point citations at lines 520 and 525 of we:scripts/conveyor/lease-reaper.mjs; implementation and tests scoped to we:scripts/conveyor/lease-reaper.mjs and we:scripts/conveyor/__tests__/lease-reaper.test.mjs.
- **Corrected premise/scope:** the paths have not moved, and the existing source/test pair remains the complete edit scope. The advanced-main case is missing coverage for an already-correct merge-base selection; the indentation case requires a production guard as well as a regression test. The aggregate comparison is at we:scripts/conveyor/lease-reaper.mjs:503-528. Its docblock at we:scripts/conveyor/lease-reaper.mjs:431-439 incorrectly calls whitespace-insensitive equivalence safe; updating that explanation belongs to this fix.
- **Source evidence:** we:scripts/conveyor/__tests__/lease-reaper.test.mjs:1365-1490 covers the two-commit squash, incomplete/different content, merge veto, merge target, empty diff, and read failure. The positive fixture forks and squashes from the same base. The unrelated-progress fixture at we:scripts/conveyor/__tests__/lease-reaper.test.mjs:1429 instead merges that progress into the lane and expects rejection; it does not cover a lane left behind main. Neither fixture changes Python indentation.
- **Observed probe:** temporary real Git repositories, importing the current `defaultGitIsAncestor`, each used two lane commits, an unrelated main commit after the fork, and one squash commit on that advanced tip. In both, the merge base differed from the squash parent, cherry emitted two `+` lines, and aggregate stable patch IDs matched. Exact content returned `true` as required. Moving the final print into the conditional by indentation alone also returned `true` (the defect). Comparing full raw change records instead distinguished the bad squash while accepting the exact squash. Temporary repositories were removed; no source was changed.
- **Consumer boundary:** `laneQuietSincePr` at we:scripts/conveyor/lease-reaper.mjs:565-583 propagates `true`/`false`/`null` into quiet-window corroboration. The imported resolver in we:scripts/lane-pool.mjs:131 consumes that gate; no caller signature or consumer edit is needed. The existing scoped test file exercises the gate directly. This is not already delivered: commit `0d90cc32198e66236ca1d4235754ba45497d7c63` introduced the aggregate tier, but the current probe still accepts the indentation mismatch.

## Design

Keep `defaultGitIsAncestor(dir, sha, { exec })` and its three-way result contract. Preserve direct ancestry, cherry containment, the unaccounted-merge veto, the single-parent restriction, nonempty patch IDs, and the merge-base-to-HEAD versus squash-parent-to-squash ranges in we:scripts/conveyor/lease-reaper.mjs. Tighten only the aggregate tier: equal stable patch IDs are a candidate match, followed by whitespace-sensitive verification before returning `true`.

For that verification, use the existing bounded `gitRead` seam to read `git diff --raw --no-abbrev --no-renames -z --no-ext-diff --no-textconv --end-of-options` for each of those same two ranges, with the existing trailing `--`. Compare the complete, nonempty outputs without trimming or whitespace normalization. Full old/new object IDs, modes, statuses, and NUL-delimited paths make differing indentation a mismatch while ignoring unrelated files unchanged within each range. Disabling rename inference makes this independent of similarity heuristics. Retain nonempty/equal stable patch IDs as the preceding gate. Unequal verification yields `false`; either verification read failing yields `null` through the aggregate catch. Keep timeouts, kill signal, and argument separation supplied by the existing reader.

This conservative check requires identical before/after objects for touched paths. Upstream edits to the same touched file can therefore cause rejection even if a human considers the squash equivalent; this guard does not attempt fuzzy containment. The required positive case is unrelated upstream progress. No Python interpreter, language-specific parser, new dependency, exported helper, schema, or migration is needed. Correct the docblock's safety claim to describe the additional verification and its conservative limit.

## MVP

**Must 1:** Add a deterministic real-Git advanced-main fixture to we:scripts/conveyor/__tests__/lease-reaper.test.mjs. Fork a lane, create two distinct commits, advance main with a disjoint-file commit, and squash the lane changes onto that advanced tip. Leave the lane checked out. Assert merge base differs from squash parent, cherry has two `+` entries, and both containment and quiet-window corroboration return `true`.

**Must 2:** Add a matching real-Git fixture whose squash differs only in meaningful Python indentation, then implement the whitespace-sensitive aggregate guard and docblock correction in we:scripts/conveyor/lease-reaper.mjs. Use a function whose final statement is outside a conditional in the lane and inside it in the squash, plus a second lane commit in a separate file. Assert the stable patch IDs match and cherry still has two `+` entries, but containment and quiet-window corroboration return `false`.

**Must 3:** Extend we:scripts/conveyor/__tests__/lease-reaper.test.mjs with injected failures for each new verification read, expecting `null`, and retain all existing aggregate and merge-veto coverage. Pin mismatching and empty verification output to rejection so a partial implementation cannot treat an inconclusive match as containment.

Implement fixtures first, then the guard and its explanation, then failure-path coverage. Land code and tests together as one small fix; size 3 remains appropriate for one local predicate and its existing test suite. No general review-policy lint or broader rewrite is part of this delivery.

## Test plan

All new tests live in we:scripts/conveyor/__tests__/lease-reaper.test.mjs, paired with we:scripts/conveyor/lease-reaper.mjs in `scope:`. Reuse temporary repositories, explicit local Git identity, and cleanup from the existing aggregate suite. Use fixed branch names within each isolated fixture and no network or real lease mutation.

For Must 1, assert the distinct revisions and unmatched cherry output before the final verdict; otherwise the fixture could pass through an earlier tier without guarding the intended choice. For Must 2, explicitly establish equal stable patch IDs and different committed Python bytes before checking `false`; this prevents an ordinary content mismatch from masquerading as whitespace coverage. Use clean working trees and timestamps already outside the quiet window for the composed assertions.

For Must 3, route injected execution through ancestry-negative, cherry-unmatched, no-merge, single-parent, equal-nonempty-patch-ID preconditions before failing each raw-diff read in turn. Assert both `null` and that the intended verification call was reached. Cover unequal and empty raw output separately. Run the complete scoped Vitest file to preserve ancestry, cherry, merge, empty-diff, timeout, and consumer regressions.

## Proof plan

1. Before changing production code, run the scoped Vitest file with the two real-Git fixtures added. Record Must 1 passing and Must 2 failing because the current function returns `true`. The preparation probe above is evidence of the defect, not a substitute for this committed regression.
2. After the fix, run `npx vitest run "$test_file"`, with `test_file` set to the checkout-relative form of we:scripts/conveyor/__tests__/lease-reaper.test.mjs. Require the entire file to pass, including both injected verification failures.
3. In a disposable copy, mutate the lane range to start at the squash parent instead of the merge base: Must 1 must fail. Separately bypass only the new whitespace-sensitive verification: Must 2 must fail. Remove each mutation and rerun the scoped suite. This proves the guards discriminate the two historical mistakes.
4. Run `npm run check:standards` for the implementation delivery. Attach the commands, outcomes, and mutation results to the review. The preparation runner owns this card's checks and stamp; independent review remains required before build-ready status.

## Done when

1. **Must 1:** The advanced-main real-Git regression passes and fails under the wrong-base mutation.
2. **Must 2:** The indentation regression fails on the original implementation, passes after the guard, and fails when only the guard is bypassed. The aggregate tier cannot return `true` solely from matching whitespace-insensitive patch IDs, and its explanation reflects that contract.
3. **Must 3:** Both verification read failures return `null`; mismatching/empty verification returns `false`; the full scoped test file and standards gate pass. Existing callers keep the same three-way interface.

## Follow-ups

No additional implementation item is required to close these two debts. Carry the review lens into this delivery's review: when choosing between apparently equivalent revisions, require a fixture where those revisions differ. Automating a repository-wide review rule is outside this card.

The earlier all-patch-equivalent cherry path remains unchanged and still has whitespace-insensitive semantics; this aggregate-tier fix must not be reported as hardening every containment path. Any broader change to that path requires separately scoped evidence and tests. Independent review should also check the conservative touched-file limitation and that no whole-tree comparison accidentally rejects unrelated main progress.
