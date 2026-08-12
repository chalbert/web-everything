---
kind: story
size: 1
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-12"
dateOpened: "2026-08-12"
dateStarted: "2026-08-12"
dateResolved: "2026-08-12"
tags: [review, mandate, jury, test-coverage, follow-up]
scope:
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
---

# The exactly-once guard on the prose rule covers one builder, so a duplicate in the validator is invisible

#3079 moved `PROSE_IMPRECISION_RULE` into `buildMandate` so every adversary receives it, and guarded against
the obvious regression — two copies drifting apart — with a count assertion. The guard reads
`buildPanelMandate` only. Its reviewer re-typed the rule into `buildValidatorMandate`, the builder the whole
change was about, and rendered **two copies** with all 270 tests still green. The other assertions use
`toContain`, which cannot tell one copy from two.

Three findings from that review, folded together because they are one touch of the same file.

## A — the count is taken in one place, not everywhere the rule appears

Fold the assertion over every builder that carries the rule rather than over the panel alone.

## B — the rule's own doc block orphaned `buildMandate`'s JSDoc

The new `export const` and its comment were inserted BETWEEN `buildMandate`'s `@param`/`@returns` block and
`buildMandate` itself. With two adjacent doc blocks the second binds to the const, so the base mandate builder
every review transport wraps has no signature documentation in IDE hover or any doc tooling. Zero runtime
effect; the fix is ordering.

## C — the rule reaches THREE transports, and only two were named

`PR_DIFF_ADAPTER` exports `buildMandate` as a contract member, and `we:skills-src/jury/resolve-roster.mjs`
calls that member directly rather than `buildPanelMandate`. So `/jury` jurors judging a PR diff now receive
the rule too. Same subject, same adversarial role, so the gain is wanted — but a gate-derivation file should
not surprise its next reader, and #3079's "reaches any future transport built on the same base" undersold a
third one that was live on day zero.

## Watch for

- `buildEditorMandate` hand-rolls its own array and does not wrap `buildMandate`; `DECISION_PROSE_ADAPTER`
  builds on the subject skeleton directly. Both are correctly absent — for a decision, framing IS the
  substance, so the rule would be actively wrong there. Do not "fix" either by adding it.

## Done when

- [x] A second copy in ANY builder that carries the rule reddens a named test.
- [x] `buildMandate` has its own JSDoc again.
- [x] The third transport is written down where the next reader of this file will see it.

## How it resolved

The count assertion is folded over `buildMandate`, `buildPanelMandate`, `buildValidatorMandate` and
`PR_DIFF_ADAPTER.buildMandate`, and it names the builder in the assertion message so a failure says WHICH one
doubled rather than only that a count was wrong. A separate test pins the adapter member the `/jury` roster
calls, so the third transport has a test and not just a sentence.

The rule and its doc comment now sit ABOVE `buildMandate`'s JSDoc, which therefore binds to the function
again. Pure move, no runtime change.

Three mutations reddened named tests, including the reviewer's own — re-typing the rule into
`buildValidatorMandate`, which was green before this.
