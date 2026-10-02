---
bornAs: xcyvee3
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/prepare-pr.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "cd03310da7b69724db9196d43390d9fd9ef591d9"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3078's independent review

Filed mechanically on approval of chalbert/web-everything#3078. The review owed prevention against prepare-ref drift, untested refusals, and incorrect incoming publication metadata. This item completes the remaining regression coverage around the existing publication guard.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3078@b262ef7cc454917c338b969c7b6fa2db5320f120

## Progress

Preparation premise audit:

- **Old premise/scope:** change we:scripts/operations/prepare-pr.mjs and its tests to record lane purpose/assigned item, recognize prepare work independently of ref spelling (or gate brief/parser drift), exercise each refusal, and assert a fixed title at the spawn boundary. The first two review bullets describe the same identity-prevention debt with alternative implementations.
- **Corrected premise/scope:** we:scripts/lane-pool.mjs already passes purpose into the lease in `tryClaimLane`. Publication still identifies prepare work by ref: `prepareItemFromRef` in we:scripts/operations/prepare-pr.mjs and its caller in we:scripts/operations/open-pr-io.mjs. The existing brief/parser contract test in we:scripts/operations/__tests__/prepare-pr.test.mjs already exercises the explicitly offered interim drift-prevention route. Complete the remaining behavioral tests in that test file; no production source change is currently justified. Every implementation target is therefore an existing test file, with no unmatched source entry in scope.
- **Evidence for partial delivery:** commit b262ef7cc454917c338b969c7b6fa2db5320f120 added the prepare-item token and brief-contract/acquire regressions. The live template in we:skills-src/conveyor/prepare-item-agent-brief.md uses `lane/{{ITEM_NUM}}-prepare-item-<slug>`. The suite also preserves the old `lane/4400-prepare-x` spelling as exempt because decision preparation legitimately uses that spelling. Broadening the parser would break that contract.
- **Remaining coverage:** `verifyPreparePr` in we:scripts/operations/prepare-pr.mjs explicitly refuses a non-main base, zero/multiple matching cards, an outside-card diff, and merge commits. Existing tests cover the latter two but not the base/card-count refusals. The generic failed-observation test stops at fetch; later git observation failures are not individually exercised.
- **Boundary drift:** the successful publication test in we:scripts/operations/__tests__/prepare-pr.test.mjs supplies a bad commit subject, but passes already-normalized planner arguments to the IO runner. It does not deliberately corrupt incoming title/SHA arguments at that boundary. Commit 1b0dc6b66 changed title construction to include the main-card subject; assert the current `WE #4368: prepare — Original card title` result, not the historical shorter title.
- **Observed baseline:** the focused Vitest run completed successfully: 1 file, 20 tests passed. This confirms the existing coverage runs; it does not prove the missing regressions.
- **Citation correction:** replace the original test-line 48/60 references with the named tests and functions above; those line numbers now point at different assertions as the suite has grown. This is partial delivery, not an already-done item.

## Design

Retain the current ref/parser and publication behavior. Strengthen we:scripts/operations/__tests__/prepare-pr.test.mjs around two seams:

1. Through `createPrLandRunner` in we:scripts/operations/open-pr-io.mjs, exercise every explicit refusal in `verifyPreparePr` in we:scripts/operations/prepare-pr.mjs. Inject deterministic git responses/failures and assert the refusal reason plus zero downstream spawn calls. Include a successful control so a runner that always refuses cannot satisfy the matrix.
2. Reuse the local git fixture to pass deliberately incorrect title and symbolic SHA arguments directly into the IO runner after planning. Assert exactly one canonical title and one resolved commit SHA in the actual spawn arguments, with the incoming values removed. Keep the main-card subject and source commit subject distinct.

Retain and strengthen the existing brief/parser test: exercise both a numeric item and an alphanumeric item supported by the parser, and keep prepare-decision and prepare-stamp exclusions explicit. This makes the already-delivered interim prevention observable without inventing lane-metadata publication policy. Per-refusal cases are the required coverage expectation here; a repository-wide mutation framework or coverage-policy change is unnecessary for this bounded debt.

## MVP

Only edit we:scripts/operations/__tests__/prepare-pr.test.mjs:

- Add named cases for non-main base, absent matching card, and multiple matching cards. Preserve the existing outside-card and merge refusals.
- Add table-driven exceptions at fetch, source resolution, card listing, diff listing, and merge listing, ensuring each earlier observation succeeds so the intended failure site is actually reached.
- Corrupt incoming title metadata at the IO boundary and supply a symbolic source that resolves to the fixture commit; check exact outgoing title/SHA multiplicity and values.
- Extend the existing brief contract assertions for supported item identifiers while preserving old-ref exemptions.

No dispatcher, lease format, title policy, parser grammar, or production guard rewrite is required.

## Test plan

Run the focused Vitest suite for we:scripts/operations/__tests__/prepare-pr.test.mjs. The refusal matrix must assert both the expected reason and absence of a spawn. Base refusal must precede any git call; each injected observation exception must preserve its diagnostic. Card-count cases must distinguish zero from two matches. Retain the real git fixtures for three-dot diff, merge ancestry, and pinned SHA behavior.

At the spawn boundary, use an incorrect title for another item after `planOpen` has returned; otherwise the planner could mask removal of the IO repair. Assert the fixture's main-card title, exactly one title argument, exactly one SHA argument, and the resolved fixture SHA. Preserve non-prepare pass-through tests.

## Proof plan

Use local git repositories and injected spawn only; no remote publication is needed. Record the focused suite result before and after adding tests. Demonstrate test sensitivity with temporary mutations in an isolated scratch copy: remove the non-main-base refusal, remove the card-count refusal, and preserve the incoming title instead of rebuilding it. For each mutation run the focused suite and require a nonzero exit tied to its new regression case; restore the scratch source between mutations. The corresponding unmutated run must pass. These probes demonstrate the specific omissions that the earlier suite allowed rather than treating a green baseline as proof of new coverage.

The runner owns preparation checks and stamping. During implementation, also run `npm run check:standards` and retain the results with the mutation evidence.

## Done when

1. The focused suite passes with a named case for every explicit refusal and every git-observation failure stage.
2. Each targeted mutation in the proof plan makes the focused suite fail; the restored source passes.
3. Deliberately wrong incoming title metadata is replaced at the actual spawn boundary with the canonical main-card title and resolved SHA.
4. The brief/parser contract remains executable and preserves decision/stamp exemptions.

## Follow-ups

The review's stronger lane-metadata identity guard remains an alternative beyond the already-present interim brief/parser contract. Any future adoption must specify metadata authority, absent/stale lease behavior, and assigned-item/ref mismatch handling before implementation; this card does not silently choose those policies. Revisit that work if observed prepare publication bypasses the controlled template. A general mutation-testing or branch-coverage policy is likewise outside this test-only scope; retain the bounded mutation probes here as acceptance evidence.
