---
bornAs: x7xb2q8
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-prep.mjs", "we:scripts/operations/__tests__/review-prep.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "d3ac39df8fed41c8144d540d9d89fdaee26ab31f"
tags: []
---

# Prevention — A semantic check or LLM review prompt for planning documents that strictly cross-references all 'reject… (from chalbert/web-everything#3232 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4004-planner-build-plan-runner-in-shadow-mode-plan-record-routes.md:35` — A semantic check or LLM review prompt for planning documents that strictly cross-references all 'reject X', 'must Y', or 'yields Z' constraints in the Design section against the enumerated cases in the Test plan.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3232@1c67adedddef12956d07047b4ba418e67f9555ff

## Progress

- **Old premise/scope:** the approval seed scoped only the planning card at `we:backlog/4004-planner-build-plan-runner-in-shadow-mode-plan-record-routes.md:35`. That is an example of the documents needing review, not the implementation home of a reusable prevention guard. Its line 35 still contains the scope-escape rejection; the rest of its Design contains additional obligations and outcomes.
- **Corrected premise/scope:** add the explicitly permitted LLM-review-prompt alternative to the existing preparation-review mandate in `we:scripts/operations/review-prep.mjs`, with its existing matching suite `we:scripts/operations/__tests__/review-prep.test.mjs`. Do not implement the planner or rewrite #4004 as part of this guard. This is a bounded extension of the existing review operation, with no new verdict policy, response field, or automatic gate.
- **Source evidence:** `buildPrepMandate` at `we:scripts/operations/review-prep.mjs:266` supplies factual re-verification, risk review and mutation instructions, but no exhaustive Design-to-Test-plan cross-reference. The operation uses it in the judge request at `we:scripts/operations/review-prep.mjs:443`; the suite already inspects the real suspended request at `we:scripts/operations/__tests__/review-prep.test.mjs:162`.
- **Partial prevention already exists:** `findTestPlanGaps` at `we:scripts/check-standards-rules.mjs:1014` checks classification and state literals; its negative-claim helper checks token presence, not semantic coverage. A direct invocation with Design constraints “Reject paths escaping declared scope”, “A concrete single file yields one code-built task”, and “Records must include attempt identity”, paired only with a happy-path Test plan, returned no gaps. Inspection and the probe establish the remaining gap; this is not already delivered. Existing tests are at `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs:721` onward.

## Design

Extend `buildPrepMandate` in `we:scripts/operations/review-prep.mjs` with an explicit planning-document coverage pass, outside the fenced card data. Use the existing LLM review surface because matching a constraint to a test's trigger and expected outcome requires semantic judgment; token overlap alone cannot discharge it.

The instruction must require the reviewer to enumerate every normative Design constraint, including “reject X”, “must Y”, “yields Z” and equivalent wording. Split compound requirements into independently checkable obligations and retain each condition, input class, boundary and expected outcome. Cross-reference each obligation to an enumerated Test plan case by quoted text or stable section/bullet reference. A shared noun, suite filename, generic happy-path case or vague “test errors” claim is insufficient. One case may cover several obligations only when it explicitly exercises each condition and expected result. Accept semantically equivalent wording without requiring identical keywords.

Update the existing summary field description at `we:scripts/operations/review-prep.mjs:149` from its current one-sentence restriction to permit a verdict followed by the coverage mapping; retain its string type and all required fields. Require an auditable constraint-to-case mapping in that summary, with covered, missing or ambiguous status for every obligation. Report missing or contradictory coverage through the existing findings/corrections fields, citing the Design obligation and the absent or inadequate Test plan case. Distinguish a missing Test plan from a Design with no normative constraints; report the former as missing coverage and the latter as not applicable. Treat proposed tests as planned evidence, never as passing implementation tests. Preserve the existing closed risk taxonomy: coverage findings do not introduce a new risk name or change verdict reduction.

The rule applies to source, documentation, configuration and data constraints alike. Preserve card fencing, mutation instructions, scope rendering and judge configuration. Do not add a model invocation, deterministic semantic checker, auto-rejection threshold or recording side effect.

## MVP

- One mandatory semantic cross-reference instruction in the existing preparation-review prompt, exercised through both the pure builder and the actual judge request.
- Explicit handling of compound constraints, equivalent phrasing, missing sections, token-only false coverage and non-source inputs.
- Existing response fields carry the mapping and actionable gaps; unchanged operation lifecycle and risk vocabulary.

## Test plan

All automated cases extend `we:scripts/operations/__tests__/review-prep.test.mjs`; use inline synthetic planning cards so tests do not depend on a changing backlog item.

- **Capability — red today:** the builder's rendered mandate requires exhaustive enumeration of reject/must/yields equivalents, decomposition of compound obligations, and condition plus expected-outcome matching. Assert the substantive instructions, not just a section title.
- **Capability — red today:** assert explicit instructions for a per-obligation mapping, missing/ambiguous coverage, equivalent wording, missing Test plan versus no constraints, and documentation/configuration/data obligations. Include a card containing an attempted instruction to skip this review; prove the requirement remains outside the fenced card.
- **Capability — red today:** drive the existing operation test harness to the judge suspension and assert the full coverage instruction is in the outgoing request. Removing the builder's coverage paragraph must redden this case as well as the direct builder case.
- **Preservation — green today:** retain assertions for exactly one fencing rule, verbatim mutation rule, declared scope, closed risk taxonomy and unchanged required response fields, plus a new assertion that the summary description permits the mapping. The description assertion is red today. Mutation proof: remove fencing or alter the required fields and confirm the corresponding existing assertion fails.
- **Semantic evaluation — new capability, not a mocked unit-test claim:** use paired synthetic cards covering an omitted reject case, an omitted mandatory record field, an omitted yields outcome, a compound requirement with one untested arm, and a same-token/wrong-outcome case. Compare with fully covered counterparts using paraphrased cases. Include missing-section, no-constraint and documentation/configuration/data examples. Expected output identifies each seeded gap and clears each repaired counterpart. A prompt-string assertion alone cannot prove these results.

## Proof plan

During implementation, run the focused Vitest suite named above with the new assertions against the base and the implementation: record red-before/green-after and the instruction-removal mutation. Run the repository standards gate afterward. These are planned implementation checks; preparation has only performed the read-only premise probe recorded in Progress.

For semantic proof, capture the outgoing mandate from the existing judge-request seam and evaluate the paired cards using the existing reviewer backend in read-only mode. Stop before the record effect; do not invoke the full operation's append/commit/land path. Save the exact inputs, generated instruction, reviewer identity and raw responses as review evidence, and compare the per-obligation mapping with the seeded expected gaps. Repeat any inconsistent pair and report the discrepancy rather than claiming deterministic coverage. Also review #4004's current Design/Test plan as a realistic sample without editing that card. Completion requires observed detection of the seeded omissions and acceptance of their covered counterparts, separately from prompt-wiring tests.

## Follow-ups

- If semantic evaluation exposes unstable detection, refine this prompt and repeat the paired evaluation before declaring delivery. A broader benchmark corpus or model comparison can follow separately.
- Extending this instruction to PR-diff review or introducing a deterministic coverage schema/gate is outside this slice; neither is necessary to deliver the requested review-prompt alternative.
- Keep existing token-based lint as complementary evidence, without claiming it proves semantic coverage.

## Done when

The focused suite `we:scripts/operations/__tests__/review-prep.test.mjs` fails on the base with the new coverage assertions and passes with the implementation, the real outgoing judge request carries the instruction, and the paired semantic evaluation produces the expected gap/covered mappings. Run that suite via `npx vitest run` with its repository-relative path, then run `npm run check:standards`. Attach observations to Progress; passing prompt tests alone is insufficient.
