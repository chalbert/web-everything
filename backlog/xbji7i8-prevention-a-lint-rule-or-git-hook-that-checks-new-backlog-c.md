---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "f3806c8b7b6562ec202dbf4ef42c343bb73f6d07"
tags: []
---

# Prevention — A lint rule or git hook that checks new backlog cards against a list of known boilerplate or unrelated… (from chalbert/web-everything#3309 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xobzl5d-review-a-finding-that-contradicts-the-pr-s-own-goal-blocks-a.md:18` — A lint rule or git hook that checks new backlog cards against a list of known boilerplate or unrelated template hints, prompting the author to remove or rewrite them.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3309@da4175a8106d050cbebf913d1d41053e6f3b16e4

## Done when

1. **Executable (Musts 1–3)** — From WE, run `npx vitest run we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` after removing the repository locator from the command argument. New capability assertions fail on the base and pass after implementation; existing content-lint assertions remain green.
2. **Observed (Musts 1–3)** — The scoped standards command on an open fixture card containing the known scaffold hint prints its rule identifier, body line, and remove-or-rewrite guidance. Replacing the hint with card-specific acceptance text removes that warning. Warnings do not change the command's exit status.

## Progress

Preparation research, 2026-10-02:

- **Old premise/scope:** the approval follow-up cited line 18 of we:backlog/xobzl5d-review-a-finding-that-contradicts-the-pr-s-own-goal-blocks-a.md and scoped only that card, although the requested deliverable is an executable prevention rule. That line is still the stray hint; the citation has not moved. Editing the example alone would not deliver prevention.
- **Corrected premise/scope:** the hint is deliberately emitted for every scaffolded card by `GUARD_RELAXATION_HINT` and `renderItem` in we:scripts/backlog/scaffold.mjs. It is not evidence that the review-classification implementation needs changing. Implement a warning in the existing pure content-lint module, with its matching existing test file in scope. The scaffold and cited card are evidence, not implementation touch targets.
- **Source evidence:** we:scripts/check-standards-rules.mjs has `findGuardRelaxationGaps`, which strips the exact hint before evaluating refusal-relaxation prose. Its `lintBacklogItemRendering` already aggregates advisory authoring warnings for unresolved cards. we:scripts/check-standards.mjs calls this shared helper for whole-repository and scoped checks. we:scripts/backlog/__tests__/scaffold.test.mjs pins hint emission; we:scripts/__tests__/check-standards-rules-content-lint.test.mjs pins the existing guard's exclusion of that hint.
- **Observed gap:** directly invoked `lintBacklogItemRendering` on the current cited card's body with open-story metadata. It returned empty errors and warnings. The requested boilerplate warning is not already delivered. No implementing commit is claimed.

## Design

Extend we:scripts/check-standards-rules.mjs with a pure known-boilerplate detector, called by `lintBacklogItemRendering` for unresolved cards alongside its existing advisory checks. Use the existing `GUARD_RELAXATION_HINT` constant as the initial known-pattern entry, with a stable diagnostic identifier and remove-or-rewrite advice. Reuse the constant rather than copying its text into another maintained list.

Match a trimmed, complete prose line equal to that hint. Report each occurrence's 1-based body line. Ignore fenced examples (backtick and tilde fences), block quotations, and inline-code quotations; these are legitimate ways to document the historical defect. Scan the full body rather than stopping at Design, so moving leftover scaffolding does not hide it. This is deterministic detection of known authoring residue, not a semantic judgment that arbitrary prose is unrelated.

Use warning severity, consistent with the neighboring prose-authoring checks. New cards receive the warning through the existing gate; unresolved older cards may also receive it. Resolved cards remain outside this new warning's integration scope. No date cutoff, new hook, diff collector, autofix, or gate exit-policy change is needed. The scaffold continues offering its authoring hint; authors remove it or replace it with actual acceptance criteria before submitting a finished card.

## MVP

1. **Must 1:** Detect the exact known scaffold hint as leftover prose and return a stable identifier and body-line location for every occurrence.
2. **Must 2:** Surface an actionable warning through `lintBacklogItemRendering` for unresolved cards, using the existing standards entry point. Keep resolved-card history and quoted examples free of this warning.
3. **Must 3:** Preserve the existing refusal-relaxation checks and their treatment of the hint; a generic hint must still neither trigger nor satisfy those checks. Keep warning-only exit behavior.

Implementation order: add capability fixtures to we:scripts/__tests__/check-standards-rules-content-lint.test.mjs; implement the detector and aggregation in we:scripts/check-standards-rules.mjs; run the focused suite and exercise the scoped standards command. This is one lint change with one matching test file, not a cleanup of the historical card corpus.

## Test plan

- **CAPABILITY — RED on base:** In we:scripts/__tests__/check-standards-rules-content-lint.test.mjs, replay the cited review-card body with its exact hint. Assert an actionable known-boilerplate warning, stable identifier, and correct body line. Exercise both open and active metadata.
- **CAPABILITY — RED on base:** Cover repeated occurrences, surrounding whitespace, CRLF, and a hint after Design; assert every detected line rather than a single boolean. Test input produced by `renderItem` to prevent drift from the scaffold constant.
- **PRESERVATION — passes on both:** Clean card-specific acceptance prose, partial mentions, fenced backtick/tilde examples, blockquotes, inline-code quotations, and resolved cards produce no known-boilerplate warning. Mutation proof: broaden matching to substring search, disable fence handling, or remove the resolved-status guard; the corresponding fixture must fail.
- **PRESERVATION — passes on both:** Existing guard-relaxation fixtures in we:scripts/__tests__/check-standards-rules-content-lint.test.mjs retain their gap results, including genuine relaxing prose with missing fail-closed/non-code acceptance and hint-only unrelated prose. Mutation proof: remove the hint exclusion or let hint text satisfy the guard; these assertions must fail.
- **CAPABILITY — RED on base:** Aggregation returns the new finding in warnings, with no new error. **PRESERVATION:** existing rendering errors remain errors. Mutation proof: route the new diagnostic into errors and require the integration assertion to fail.

## Proof plan

At implementation time, retain the new capability tests against the base to record their assertion failures, then run the focused suite after the patch. Do not count a missing export/import as the only red proof; demonstrate the existing aggregation's failure to report the hint.

In a disposable checkout, create an open fixture card with valid frontmatter and the exact hint. Run the existing scoped standards entry point (`node we:scripts/check-standards.mjs --item=<fixture-id>`, stripping the repository locator for shell execution). Capture the diagnostic and process status, rewrite the hint to meaningful acceptance text, and repeat. Run the same fixture as resolved and confirm the warning is absent. Remove the fixture afterward. Finally run `npm run check:standards` from WE and record any unrelated baseline findings separately. Preparation itself only established the current missing warning; implementation proof remains to be collected.

## Follow-ups

Expand the known-pattern list only when another concrete leaked scaffold phrase has a regression fixture. Semantic relevance classification, warning promotion to an error, changing scaffold output, and bulk historical cleanup are separate work; none is required to deliver this exact, actionable authoring warning.
