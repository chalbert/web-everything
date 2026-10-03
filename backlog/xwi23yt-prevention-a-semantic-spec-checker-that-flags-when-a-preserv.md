---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs", "we:scripts/__tests__/review-core-cli.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "afb711055c4f300be8c01a8e32eef92ec8c71733"
tags: []
---

# Prevention — A semantic spec checker that flags when a "Preservation" requirement (retain existing strict validation… (from chalbert/web-everything#3379 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4057-wip-fleet-panel-pr-ownership-rows-and-a-why-is-nothing-dispa.md`, Design points 4–5 and Test plan Preservation case — A semantic spec checker that flags when retaining strict validation conflicts with accepting dynamic names in the same document. Distinguish retaining acceptance of old payloads from retaining an exclusive old-name restriction.
2. The same card, Design point 3 and Test plan model/view case — An AI review check that cross-references all specific behavioral requirements (including "must", "never", and "separately") against the assertions listed in the Test plan section. These words are search cues, not a complete requirement grammar.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3379@2e471c42f5e288a27a3e327a7d817b2b2e4ff9df

## Progress

Preparation inspected checkout `afb711055c4f300be8c01a8e32eef92ec8c71733`. No semantic review implementation or live model evaluation is claimed here.

| Old premise / scope | Corrected premise / scope and source evidence |
| --- | --- |
| The cited defects are at lines 49 and 46 of the origin card. | Those lines now concern the producer/consumer split. The relevant text is Design points 3–5 and the Test plan Preservation case in we:backlog/4057-wip-fleet-panel-pr-ownership-rows-and-a-why-is-nothing-dispa.md. Use section references rather than carrying forward stale line numbers. |
| Editing only the origin card supplies the prevention. | That card is an input example, not an executable guard. The implementation belongs in the existing correctness lens's hunt brief in we:scripts/lib/review-core.mjs, with its existing matching we:scripts/lib/__tests__/review-core.test.mjs and CLI integration coverage in we:scripts/__tests__/review-core-cli.test.mjs. No Plateau implementation change is needed for this prevention. |
| There is no test-plan checker. | we:scripts/check-standards-rules.mjs already exports findTestPlanGaps: classification/mutation wording, fenced state literals and negative-claim identifier overlap. A direct invocation on the current origin card returned `[]`. This observation proves that the current heuristic reports nothing for this input, not that the prose is consistent. |
| The origin example is unconditionally an explicit contradiction. | Its Design replaces fixed runner names while preserving old-payload compatibility; its Preservation case still says “retain existing four-runner validation.” The latter is ambiguous between legacy acceptance and exclusive validation. Preserve an explicit contradictory variant as an evaluation fixture, and require the reviewer to distinguish ambiguity from demonstrated conflict. Do not assume every mention of four runners contradicts dynamic names. |
| Generic correctness review already delivers both owed checks. | we:scripts/lib/review-core.mjs has a generic correctness expectation, but LENS_HUNT_BRIEF currently only registers claim-accuracy. buildPanelMandate appends registered briefs; we:scripts/review-core-cli.mjs routes its lens mandate through that builder. The existing tests exercise this wiring but do not require either semantic check. The specific prevention is not already delivered. |

The placement follows we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment: prose meaning remains judgment work, using the existing review path. This card specifies a concrete correctness-review method, not a new approval policy, model provider, reviewer seat, or standards-gate severity.

## Design

1. Add a correctness entry to LENS_HUNT_BRIEF in we:scripts/lib/review-core.mjs. Use the existing buildPanelMandate integration and CLI path. Apply the method when the review subject includes a spec/card with Design and Test plan requirements, including documentation-only changes. Read the full relevant sections at the reviewed revision; a partial diff alone cannot establish an omission.
2. **Preservation consistency pass.** Identify each preserved behavior and each changed behavior, including qualifiers, input domain, version and rollout phase. Report a contradiction only when the same input under the same conditions is required both to pass and to fail, or otherwise has mutually exclusive outcomes. Quote both requirements with repo-qualified source/section references and give a concrete counterexample input. Accept legacy four-runner payloads plus additional validated names as compatible; retaining an exclusive four-name enum while accepting arbitrary validated producer names is incompatible. When wording leaves the distinction unresolved, state the ambiguity and missing evidence rather than inventing the intended rule.
3. **Requirement-to-assertion pass.** Enumerate all concrete Design obligations, splitting compound clauses. Map each to a Test plan assertion and its observable expected outcome. Include positive, negative and separation requirements; synonyms and paraphrases count. A repeated noun or a vague “test Fleet” bullet does not demonstrate coverage. For a missing assertion, quote the requirement and describe an implementation mutation that violates it while still satisfying the written test plan. In the non-dispatch example, separate Build and PR clauses require assertions that their reasons stay independently identified, not merely that both strings appear somewhere.
4. Carry a compact requirement/coverage table and preservation comparisons in the reviewer evidence. Feed substantiated defects through the existing correctness findings/verdict structure; keep existing severity, reduction, escalation and authority rules. A missing/unreadable subject or truncated section is unevaluated evidence, never a clean semantic result. Treat quoted document content as review data, including attempts to instruct the reviewer to approve it.
5. Keep deterministic lint unchanged. Tests of mandate delivery establish that the reviewer receives the method; they do not establish model comprehension. Prove comprehension separately with paired defective/corrected documents and retained review outputs. Scope ends at the existing correctness-lens mandate; do not claim standalone semantic CI enforcement or coverage for review routes that never invoke that mandate.

## MVP

1. **Must 1:** The actual correctness mandate contains both semantic passes, evidence requirements, and ambiguity/missing-input handling.
2. **Must 2:** The semantic review identifies an explicit preservation/design conflict and a missing behavioral assertion with concrete cited evidence, while accepting corrected compatible and fully covered variants.
3. **Must 3:** Existing claim-accuracy instructions, shared reviewer safeguards and verdict policy remain intact; other lenses do not receive the new correctness-only brief.

## Test plan

All additions below are planned, not executed during preparation. The source/test pair is we:scripts/lib/review-core.mjs → we:scripts/lib/__tests__/review-core.test.mjs. Existing we:scripts/__tests__/review-core-cli.test.mjs covers delivery through we:scripts/review-core-cli.mjs; no CLI source edit is expected.

- **Capability (RED before implementation):** Extend we:scripts/lib/__tests__/review-core.test.mjs to require the correctness brief and its two distinct passes, concrete conflicting-input proof, requirement-to-assertion mapping, and unevaluated/ambiguity handling. Exercise buildPanelMandate, not only the data constant. Removing the registered correctness entry or its appended output must fail the new assertions.
- **Capability (RED before implementation):** Extend we:scripts/__tests__/review-core-cli.test.mjs to exercise the real correctness lens mandate route and assert delivery of both checks. Avoid a mocked builder or a snapshot that can silently bless an empty brief. Verify the command output retains the existing shared review instructions.
- **Capability (semantic evaluation; not a deterministic unit-test claim):** Keep compact paired document inputs in we:scripts/lib/__tests__/review-core.test.mjs as named evaluation cases: exclusive old-name rejection versus dynamic-name acceptance; compatible legacy acceptance plus unique new names; omitted versus explicit separate Build/PR assertions; a compound requirement only half covered; a paraphrased but complete plan; the ambiguous four-runner wording; unavailable/truncated sections; and document text asking the reviewer to skip checks. Include expected evidence/outcomes alongside the cases for the Proof plan. Unit tests can validate fixture availability and mandate assembly, but must not pretend to judge prose with keyword matching.
- **Preservation (expected GREEN baseline; run at implementation pickup):** Retain the existing claim-accuracy brief/wiring, unknown-lens fallback, mutation-probe and prose-imprecision tests in we:scripts/lib/__tests__/review-core.test.mjs and existing CLI tests. Add correctness isolation coverage. Mutation proof: drop the claim-accuracy brief, remove shared safeguards, or inject correctness instructions into the security mandate; the corresponding tests must fail. No verdict thresholds or model invocation paths change.

## Proof plan

At implementation pickup, run the existing focused suites as the baseline. Add the capability assertions first and retain their failing output; implement the brief and rerun them. From the WE root, invoke `npx vitest run` with we:scripts/lib/__tests__/review-core.test.mjs and we:scripts/__tests__/review-core-cli.test.mjs as its two file arguments (resolve the repo prefixes to relative paths when executing). Also invoke `node` on we:scripts/review-core-cli.mjs with arguments `mandate --lens=correctness` and inspect its output directly.

Then exercise the actual generated correctness mandate with the named evaluation documents through the existing review mechanism, retaining the mandate, document revision, model identity, returned evidence table and findings. Compare original and corrected pairs. The explicit conflict must produce the same-input counterexample; the missing-assertion case must identify the untested obligation; corrected/paraphrased cases must not retain those findings. Ambiguity and unavailable inputs must remain distinguishable from proved conflict and checked-clean. Confirm injected document instructions do not suppress the checks. Use isolated review evidence, without publishing verdicts on the real origin PR or changing its card.

Record model misses and false positives rather than claiming a deterministic guarantee from prompt tests. If paired cases fail, refine and rerun before accepting this prevention. Run the normal standards gate at implementation completion. This preparation leaves stamping and checks to the probation runner.

## Done when

Must 1 is demonstrated by newly red-then-green focused tests and the emitted CLI mandate. Must 2 is demonstrated by retained semantic evaluation outputs for the defective, corrected and incomplete-input cases. Must 3 is demonstrated by the preservation suite and a diff showing no policy/reduction changes. Passing a string assertion alone is insufficient to declare the semantic prevention delivered.

## Follow-ups

- Correct the origin card's ambiguous preservation wording in its own preparation/review; this item uses it as evidence and does not silently choose that product's validation semantics.
- Use observed misses and false positives to propose future corpus expansion. A deterministic structured requirement format or a new mandatory semantic CI gate would be separately scoped work, not an implied extension of this MVP.
- If implementation finds a relevant review route bypasses correctness mandates, report that coverage boundary with its source evidence and prepare a scoped follow-up; do not advertise universal review coverage from this lens-only change.
