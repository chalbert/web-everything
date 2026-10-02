---
bornAs: xp0hefv
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:docs/agent/backlog-workflow.md", "we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-01"
preparedAgainstSha: "3aa47415089804e2b1274f5a66571ca8b87f0303"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2962's independent review

Carry forward the approval's prevention debt: require evidence for claimed classifier defect sites and adversarial mixed-input tests when relaxing gate classifiers. Retain the existing required-kind schema guard rather than restoring the retired `workItem` field.

Filed mechanically on approval under the operator's 2026-09-27 rule that outstanding prevention is filed by default. These guards did not block that approval.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2962@ec79e6d8566906cc3ce71fccc3f5186927376c63

## Progress

Preparation research on 2026-10-01 found partial existing coverage, not completion of the whole goal.

- **Old premise/scope:** the approval named two review lenses against `we:backlog/4501-ci-heal-treats-a-red-soak-replay-gate-as-red.md:13` and `we:backlog/4503-soak-replay-gate-don-t-read-not-a-bug-fix-as-a-bug-fix.md:34`, plus a new lint requiring `workItem` against the former card's line 2. Scope listed only those two incident cards. These line references describe historical review locations, not current implementation sites.
- **Corrected premise:** `we:docs/agent/backlog-workflow.md` under “Authoring an item” and “Agile sizing” requires the merged `kind` axis. `we:scripts/check-standards-rules.mjs` documents the retirement of `type`/`workItem` beside `BACKLOG_KINDS`; `validateBacklogItem` already rejects missing and invalid `kind`. `we:scripts/check-standards.mjs` section 6d invokes that validator for every loaded backlog item. A direct Node probe of the validator returned a missing-kind error for undefined, an invalid-kind error for `bogus`, and zero errors for a valid task without `workItem`. Requiring the retired key would introduce a defect.
- **Classification evidence:** the docblock for `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` in `we:scripts/conveyor/main-red-recovery.mjs` identifies it as attribution fallback, not the entire CI classification policy. In `we:scripts/conveyor/reconcile-pass.mjs`, `runReconcilePass` now reads live required checks before passing them to `enrichMainRed`; #4501's wiring fix is present. This is the concrete example for the first review lens, not additional runtime work here.
- **Mixed-input evidence:** `isLikelyDaemonBugFix` in `we:scripts/lib/soak-replay-gate.mjs` still ORs title, header, and raw body-word signals. The current #4503 card already plans denial-plus-positive tests in `we:scripts/lib/__tests__/soak-replay-gate.test.mjs`. That local plan does not establish a reusable authoring requirement. Searching the agent guidance found no explicit docblock/caller classification-path check or exemption-next-to-trigger requirement.
- **Corrected scope:** add the reusable review checks to `we:docs/agent/backlog-workflow.md`, and extend the existing schema regression suite `we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs`. That suite already pins missing `kind`; add explicit invalid-kind and valid-without-workItem coverage. No production source change is needed, so there are no unmatched source entries in scope. Documentation is checked by the manual review exercise below, not a test that merely greps prose. The incident cards and runtime files above are evidence only.

## Design

Place two explicit checks together under “Authoring an item” in `we:docs/agent/backlog-workflow.md`, where future defect cards are authored:

1. Before naming a constant or function as the defect site, read its docblock and callers, then cite the actual classification path with repository-qualified source references. Distinguish defaults, caller-supplied inputs, attribution, and the final gate verdict; demonstrate the failing branch with an observed input/output pair. A matching symbol name alone is insufficient evidence.
2. For any relaxation of a gate classifier, require a test-plan case containing both the proposed exemption phrase and an independent real trigger. State the expected outcome: the independent trigger must remain effective under that gate's existing contract. Include an exemption-only control. For #4503, a denial alone should stop triggering the body-word heuristic, while a denial beside an affirmative bug signal must retain classification.

These are review lenses, as authorized by the originating approval. Free-form prose does not supply a reliable machine-readable classifier-change predicate or prove that a mentioned test asserts the right result; do not introduce a keyword lint that pretends otherwise.

For the third guard, cite the existing `kind` requirement and validation in the guidance. Preserve `BACKLOG_KINDS` as the enum authority and pin current behavior through the existing test suite. Do not create a second frontmatter parser, duplicate enum, or require `workItem`.

## MVP

1. Add the two review checks and the current-schema clarification to `we:docs/agent/backlog-workflow.md`, using #4501 and #4503 as short worked examples with current source symbols instead of historical line numbers.
2. Extend `we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs` with fixtures proving that an unknown `kind` is rejected and a valid task without `workItem` passes. Retain its existing missing-kind regression. Use otherwise-valid fixtures so unrelated sizing or parent errors cannot masquerade as schema rejection.
3. Keep classifier implementations, incident-card preparation, and schema changes outside this delivery. The remaining deliverable is durable authoring guidance plus regression coverage of the already-existing mechanical guard.

## Test plan

- In `we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs`, assert the specific missing-kind diagnostic, the invalid-kind diagnostic for an unknown value, and zero errors for a valid task omitting `workItem`.
- Run the focused Vitest suite for `we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs` and the existing kind-axis suite `we:scripts/__tests__/check-standards-rules-kind-axis.test.mjs`.
- Manually exercise the guidance against two deliberately incomplete card drafts: one blames an attribution fallback without following the live caller; the other relaxes negation handling but tests only denial-only input. Each must be returned for the specific missing evidence/test. Corrected drafts carrying the caller path and mixed-input expected verdict must satisfy the checks.
- Run `npm run check:standards` during delivery. The probation runner owns preparation checks and stamping.

## Proof plan

Record the before/after guidance diff and the two draft-review outcomes. Before delivery the explicit reusable checks are absent; after delivery each incomplete draft has a named violated checklist requirement and a concrete correction.

Record focused test output and standards-gate output. The schema probes should pass both before and after because that guard is already implemented; do not claim a new red-to-green production fix. To demonstrate regression sensitivity, temporarily remove the missing-kind check and then the enum-membership check in an isolated test copy of `we:scripts/check-standards-rules.mjs`; the corresponding assertions must fail, and pass again with the original module restored. Do not retain those mutations in the delivery diff.

## Follow-ups

- #4503 owns the actual negation-classifier correction and mixed-input runtime cases; this item provides the reusable requirement and does not duplicate that implementation.
- Revisit deterministic card lint only if a structured classifier-change declaration and verifiable test-case contract become available. No speculative keyword lint or new policy decision is required for this MVP.
- No new missing-workItem work item is owed: the merged-kind requirement already has an executable validator and the delivery pins its relevant behavior.

## Done when

1. The authoring guidance contains both explicit review checks and accurately describes the existing `kind` schema guard.
2. The focused schema tests and standards gate pass, and the manual draft exercise records both rejected incomplete drafts and accepted corrected drafts.
3. Evidence distinguishes newly added review guidance from already-delivered schema enforcement; no retired field or duplicate validator is introduced.
