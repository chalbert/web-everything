---
bornAs: x7ox8c2
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "9642ad4574b3e08a446e2fd95889caa79f4faaa8"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2976's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4518-build-and-fix-daemons-actually-hand-work-to-agy-when-routing.md (Design and MVP sections)` — Add a card-authoring review lens: every branch in a Design section must map to at least one reachable input under the MVP's stated gate.
2. `we:backlog/4519-decide-the-next-task-types-to-open-for-agy-workers-bugfix-co.md (opening evidence and Operator ruling sections)` — When a decision card cites a gate's precondition, quote the exact gate wording and state explicitly which roster members' data counts. This is a review-lens note, and no deterministic gate applies.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2976@5230779fc742465c61a4e93661948972b3008772

## Progress

Premise checked against the acquired checkout on 2026-10-02.

- **Old premise/scope:** the two cited cards were the entire edit scope; their historical line references identified the review findings, and Done when demanded an unspecified executable red/green command.
- **Corrected premise/scope:** those cards are examples of two authoring defects, not the implementation homes of the prevention. Add the two reusable review checks to `we:docs/agent/backlog-workflow.md`, beside its existing card-authoring/readiness guidance. This is a documentation-only review-lens change; no runtime source entry or matching unit-test file belongs in the edit scope. Its matching manual review cases are specified below. The two original paths remain evidence, with section references replacing stale line numbers.
- **Source evidence:** `we:backlog/4518-build-and-fix-daemons-actually-hand-work-to-agy-when-routing.md`, Premise check, records wiring already delivered by `a143611f6` and `5414b50cc`; its retained Design/MVP is historical, not a current implementation mandate. That does not deliver this card's authoring guards. `we:backlog/4519-decide-the-next-task-types-to-open-for-agy-workers-bugfix-co.md` itself distinguishes three Codex doc-fix runs from zero agy doc-fix runs, despite its broader opening zero-data claim, and later records partial operator rulings.
- **Current code evidence:** `we:scripts/lib/provider-routing.mjs#CRITICAL_WORK_GATE` now aliases validated policy; `we:scripts/lib/dispatch-routing-policy.mjs` imports the initial snapshot through `we:scripts/lib/dispatch-routing-policy-source.mjs`, whose disk home is `we:scripts/lib/dispatch-routing-policy.json`. The policy's exact reason is “a non-Claude worker takes gated work only for a non-critical task of an opened taskType”. `we:scripts/lib/provider-routing.mjs#decideCriticalWorkGate` additionally requires a supplied non-critical verdict and critical-miss list. Its `PROBATION_ROSTER` currently includes Codex-only features, Codex/Gemini prepare, Gemini-only test-fix, agy-Claude/Codex doc-fix, and all three workers for ci-heal and bugfix; conflict-resolution remains closed. Thus neither the original two-task opening nor an agy-only evidence denominator can be assumed today.
- **Delivery check:** searching the existing authoring guidance in `we:docs/agent/backlog-workflow.md` and review workflow in `we:docs/agent/delivery-loop.md` did not find these two specific checks. Existing routing tests in `we:scripts/lib/__tests__/provider-routing.test.mjs` and `we:scripts/lib/__tests__/dispatch-routing-policy.test.mjs` concern runtime behavior, not whether prose faithfully describes it. No delivering commit for the requested documentation guards was established.

## Design

Add a named card-authoring review checklist in `we:docs/agent/backlog-workflow.md` with two checks:

1. **Design/MVP reachability:** enumerate each promised Design branch and supply at least one concrete input satisfying the MVP's stated gate and the branch's own conditions. Record the input, gate conditions and expected branch. A branch with no witness must be corrected or explicitly moved to Follow-ups; a hypothetical future opening is not a witness for today's MVP. Check the actual source rather than inferring reachability from a task label.
2. **Gate precondition and evidence population:** when a decision relies on a gate precondition, quote the exact authoritative wording, cite its source symbol/section and distinguish current executable policy from a historical comment or ruling. State which roster members, task types, roles, models and time window the cited evidence covers, including exclusions. An agy-only zero must not become a roster-wide zero if Codex data exists. If the wording does not settle whether a narrower population suffices, expose that unresolved choice in the decision; the reviewer must not invent policy.

These are semantic review checks, not a new deterministic gate or a new review-seat allocation. Keep the rule in one authoring home and use the originating cards as dated examples, not a permanently hardcoded roster. The goal is prevention of the two accepted review findings; no task-type opening or routing implementation is authorized by this story.

## MVP

Edit only `we:docs/agent/backlog-workflow.md`: add both checks, a small branch/input/gate/outcome example, and a contrasting population example where one roster member has trials and another has none. Include the expected finding and corrected prose for each example. Link this debt's originating cards for lineage. Do not rewrite the historical cards or copy their stale gate values into a current rule.

## Test plan

Documentation-only scope: manual review cases are the matching tests for `we:docs/agent/backlog-workflow.md`; no runtime test file is added or changed.

1. Negative reachability case: MVP opens only simple tasks, while Design promises both simple and non-simple dispatch. The checklist produces a finding for the non-simple branch because no input satisfies both conditions.
2. Positive reachability case: the same card moves the non-simple branch to Follow-ups and gives a simple input satisfying every MVP condition. The checklist accepts the retained branch.
3. Negative population case: a three-worker roster has three Codex doc-fix trials and zero agy doc-fix trials; prose says the roster has no doc-fix evidence. The checklist rejects the population mismatch and asks for the exact cited precondition.
4. Positive population case: prose separately reports the Codex and agy counts, quotes and cites the precondition, and explicitly states whether it addresses all workers or only agy. Accept the factual account without treating it as permission to open a gate.
5. Run `npm run check:standards` for documentation consistency when implementing. Its success is structural validation, not proof that either semantic check was applied correctly.

## Proof plan

Before implementation, capture the existing authoring guidance and show the absence of the two explicit checks. After implementation, cite their new section and record the four review-case outcomes above, including the finding text for each negative case. Reapply the checks to the historical Design/MVP and zero-data passages cited in Progress, preserving their date and subsequent corrections. Demonstrate that the checklist identifies the defects without claiming today's runtime has the old gate or missing dispatch wiring. No live worker launch, scorecard mutation, soak break, or synthetic executable red/green claim is needed for these prose guards.

## Follow-ups

- Any routing-policy opening remains with the existing decision process and its current evidence; this story does not choose whose data is sufficient for graduation.
- If repeated review observations later reveal a mechanically decidable subset, file a separate narrowly scoped lint proposal with false-positive examples. Do not turn semantic reachability or evidence sufficiency into a string-matching gate here.

## Done when

Both review checks and their worked examples are present in `we:docs/agent/backlog-workflow.md`, all four manual review cases have recorded expected outcomes, and the documentation consistency gate passes. Replace the original executable-placeholder requirement with this honest review-based proof; no deterministic gate applies to the requested judgment checks.
