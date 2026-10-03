---
kind: story
size: 3
status: open
scope: ["we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "21e5e1bb1cac2dd2079b42c69f0b6b88e55d8098"
tags: []
---

# Prevention — Pin repository context at both drain review call sites

Filed from chalbert/web-everything#3590 review of head `8f3620a76219844260f71209e50ba4d75f7535a8`: prevent a future wiring regression from verifying a sibling PR against the process repository.

## Progress

- Original premise/scope: add a wiring assertion for `decideDrainReviewGate` and `reconcileDrainReviewPending`, optionally exercise an injected sweep; only we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs was scoped. The historical citation to line 378 now points to a helper-level gate invocation, not the production wiring assertion.
- Corrected premise/scope, inspected at `21e5e1bb1cac2dd2079b42c69f0b6b88e55d8098`: production already supplies the correct context. In we:scripts/merge-ai-prs.mjs:4193, reconciliation passes `cwd: siblingCloneDir(repo)` and `local: isLocalRepo(repo)`; at we:scripts/merge-ai-prs.mjs:4922, the review gate passes `cwd: escCwd` and `local: isLocalRepo(v.repo)`. The derivation at we:scripts/merge-ai-prs.mjs:4685 selects the sibling clone only for non-local PRs. No production change is required; retain the existing test-only scope, which already names the matching test file.
- Source evidence: we:scripts/merge-ai-prs.mjs:603 guards fingerprint reads with `local || cwd` and forwards `cwd` to git execution. The helper test at we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs:392 already pins a diff read to a sibling clone. The wiring test at we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs:618 checks defer handling and reconciliation-call presence but does not assert either call's repository-context arguments. The prevention goal remains undelivered.

## Design

Extend the source-wiring coverage in we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs. Read we:scripts/merge-ai-prs.mjs using the existing module-relative source-read pattern and assert each production call's argument object independently:

- Reconciliation must pass `cwd: siblingCloneDir(repo)` and `local: isLocalRepo(repo)` in the object passed to `reconcileDrainReviewPending`.
- The review gate must pass `cwd: escCwd` and `local: isLocalRepo(v.repo)` in its second argument, and the enclosing escalation path must derive `escCwd` from `isLocalRepo(v.repo) ? undefined : siblingCloneDir(v.repo)`.

Bound each match to its own call/argument object so a matching property elsewhere in the source cannot satisfy it. Allow harmless whitespace changes. Preserve the existing defer-branch assertion and helper-level behavioral coverage. This is an assertion of current wiring, with no acceptance-policy change or new runtime seam.

## MVP

Add separately named wiring tests for reconciliation and the review gate, including the `escCwd` derivation. Keep all implementation edits in we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs. Production we:scripts/merge-ai-prs.mjs is read-only input to these tests. No full-sweep harness is needed for this minimum prevention guard.

## Test plan

Run the focused Vitest suite for we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs. The existing suite covers sibling-clone forwarding, missing-clone refusal, unreadable evidence, pending reconciliation, and dry-run behavior; the added assertions cover the production callers that those helper tests bypass.

Mutation cases must independently remove or miswire each call's `local` and `cwd`, and replace the sibling derivation of `escCwd` with the process cwd. Each mutation must fail the corresponding new assertion even while the other call remains correct. A whitespace-only reformat of the checked calls must pass. Restore every temporary mutation before delivery.

## Proof plan

Record the focused suite passing against unmodified production source, then the named failing assertion for each isolated wiring mutation, followed by a clean passing rerun. The current production wiring is correct, so the unmutated baseline should pass; red/green evidence comes from the regression mutations, not from claiming the present runtime is broken. These source assertions plus the existing helper test establish wiring coverage, not a live sweep execution claim.

Run the focused suite from the WE checkout with `npx vitest run` followed by the path we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs (remove the documentation-only `we:` prefix when passing the filesystem argument). Run `npm run check:standards` for implementation delivery. Preparation leaves checks and stamping to the runner.

## Done when

1. Both production call sites have independent context assertions, and the review gate's cwd derivation is pinned.
2. Each removed or miswired context argument fails its new assertion; the unchanged wiring and whitespace-only edits pass.
3. Existing helper and defer-path coverage remains green, and only the scoped test file changes during implementation.

## Follow-ups

A full sweep driven through an injected execution seam could provide broader integration evidence. It is optional future work and outside this test-only item; do not introduce a sweep refactor to deliver these assertions.
