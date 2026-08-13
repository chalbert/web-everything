---
kind: story
size: 1
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-13"
dateOpened: "2026-08-13"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
tags: [review, mandate, jury, test-coverage, agent-memory]
scope:
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:agent-memory-src/a-guarantee-in-prose-is-a-test-with-the-wrong-syntax.md
---

# A guarantee stated in a comment is not checked by anything

Over one week the reviewers found **ten** properties in the operations engine with no test at all — each by
deleting the behaviour and watching the suite stay green. Every one of them had a comment describing it.
Among them all three "hand this back to a human" cases in the waker, which is the safety property #3070's
ruling rests on, and a `catch` block called belt-and-braces for four rounds that turned out to be the only
thing keeping one bad run from stopping a pass.

Separately, three claims in the same period were outright FALSE. All were about safety properties. All were
in comments. All were caught by someone running the code rather than reading it.

The common failure is not verbosity. It is writing a paragraph in the slot where a test belongs, which costs
twice: the guarantee goes undefended, and the sentence can rot into a lie.

## Why the mandate and not a lint

A mechanical version was tried and dropped on evidence: an absolutes lint over the same prose produced 396
false positives on correct text. "This sentence claims a guarantee" is not script-decidable, and the
hookable-vs-judgment rule keeps judgment out of hooks.

The mandate is also where it belongs for a second reason — it is what the good reviewers were ALREADY doing by
instinct. All ten came from reviewers mutating source unprompted. Writing it down turns the most productive
technique of the week from luck into instruction, and binds every session rather than the ones that happen to
recall a memory.

## Watch for

- It must be framed as COVERAGE, not as prose. `PROSE_IMPRECISION_RULE` — which lands in the same mandate —
  says wording is never worth a bounce. A guarantee finding read as a prose finding would be unraisable.
- Two of the three false claims were a DEFAULT value quietly satisfying a check written for the explicit
  value. Worth naming in the clause, because it is the shape that keeps recurring.

## Done when

- [x] Every adversary is told to find the test behind each stated guarantee, and to mutate.
- [x] The finding routes as coverage, so the prose rule does not swallow it.
- [x] The authoring half is in agent memory.

## How it resolved

`GUARANTEE_NEEDS_A_TEST_RULE` sits beside `PROSE_IMPRECISION_RULE` in `buildMandate`, so it reaches the same
four transports the prose rule does — panel, validator, base, and the PR-diff adapter the `/jury` roster
calls. It names the technique (break the guarded line, confirm a NAMED test reddens) rather than only the
principle, because the technique is what the reviewers were already using.

Two findings from #3080's own review are folded in, and both are the same defect one argument out:

- the exactly-once count was per-DEFAULT-ARGS, not per-rendering. A second copy inside `buildPanelMandate`'s
  optional GROUND TRUTH block — #2450's live drain path — left all 271 tests green. The count now runs over
  renderings, including that branch and a round-2 one.
- the "deliberately absent" half was prose only. Adding the rule to `buildEditorMandate` left the suite green.
  Both absences are asserted now, using the `not.toContain` idiom this file already ships for
  `EDITOR_WRITE_TARGET_PR_CLONE`.

That second one is the rule catching its own author on the same day it was written, which is the most useful
thing that could have happened to it.
