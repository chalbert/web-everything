---
bornAs: xwqr34z
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "afb711055c4f300be8c01a8e32eef92ec8c71733"
tags: []
---

# Prevention — When a card promises 'X still refuses' while reusing an existing predicate, require it to cite that pre… (from chalbert/web-everything#3450 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4767-keep-the-review-across-a-ci-heal-that-leaves-the-pr-own-chan.md (Design and Test plan)` — When a card promises 'X still refuses' while reusing an existing predicate, require it to cite that predicate's documented known gaps. A review-lens checklist item is enough; a script gate is not practical for this.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3450@8bb8192bba568e6215efbc0902e529619baf1df5

## Progress

Preparation checked the current source rather than treating the incident citation as the implementation target.

- **Old premise/scope:** the mechanically filed scope named only we:backlog/4767-keep-the-review-across-a-ci-heal-that-leaves-the-pr-own-chan.md, with a line-48 citation and an executable TODO. That card is now resolved and records implementation of the CI-heal carry. Its current Design and Test plan are the relevant historical promises; the old single-line citation does not identify the reusable prevention surface.
- **Corrected premise:** the missing work is a review checklist requiring a refusal promise to acknowledge the reused predicate's documented limitations. The existing claim-accuracy hunt brief at we:scripts/lib/review-core.mjs:1922-1945 covers factual prose and source resolution, but its six listed shapes do not require known-gap citations or an input-kind/error inventory. The generated mandate includes this brief at we:scripts/lib/review-core.mjs:1119. The prevention is not already delivered by the resolved CI-heal implementation.
- **Source evidence:** the guarded caller invokes `acceptanceCoversHead` at we:scripts/review-set-label.mjs:1224. Its contribution escape is implemented at we:scripts/lib/review-escalation.mjs:2195-2218. The contribution normalizer explicitly documents dropped context/position information and shape-preserving relocation false honours at we:scripts/lib/review-escalation.mjs:1600-1681; the relocation cases in we:scripts/lib/__tests__/review-escalation.test.mjs:1783-1790 preserve that limitation. Reusing this predicate cannot establish an unqualified promise that every real contribution change refuses. This item requires honest qualification, not a new equivalence policy.
- **Corrected scope:** change we:scripts/lib/review-core.mjs and its existing matching suite we:scripts/lib/__tests__/review-core.test.mjs. The historical card, carry implementation and digest tests are research evidence, not edit targets. Keep the original goal: prevent unsupported refusal claims through a review-lens checklist, without adding a semantic script gate.

## Design

Extend the existing claim-accuracy lens in we:scripts/lib/review-core.mjs. Add a concise requirement to `LENS_EXPECTATIONS` and an actionable checklist to `LENS_HUNT_BRIEF`, so the registered bar and generated review mandate agree.

For a card promising “X still refuses” (or equivalent) while reusing a predicate, require the reviewer to trace the actual caller and predicate, open its documented known gaps and relevant tests, and verify the card cites and qualifies applicable limitations. If documentation states no gaps, say what was inspected; absence of documentation is not proof of completeness. Report a concrete mismatch or missing required evidence, with source citations, rather than inventing a limitation.

For a card loosening a refusal, require two explicit Must lines in that card:

- **Must — errors:** identify unreadable/missing/error evidence and the refusal or existing guarded fallback it must trigger; a successful reused predicate alone is not proof of caller error handling.
- **Must — input kinds:** enumerate affected source, tests, documentation, configuration and data, including other applicable non-source inputs, and state which remain subject to refusal checks. Any exclusion needs evidence, not an assumption that non-code changes are harmless.

The checklist must distinguish a promised safeguard from a documented residual. In the motivating example, unchanged digest projection can still honour a shape-preserving relocation; the reviewer must require that qualification, not demand an unapproved digest-policy change. Retain the lens's existing requirement to resolve claims against source before reporting them. Do not change lens membership, blocking policy, or review dispatch.

## MVP

Ship only the expectation/checklist wording and regression coverage in the two scoped files. Use the existing claim-accuracy lens and mandate assembly; no new lens, parser, standards gate, runtime refusal logic or retrospective rewrite of the resolved incident card. The rule applies when the trigger claim occurs in prose already covered by the lens.

## Test plan

Extend we:scripts/lib/__tests__/review-core.test.mjs alongside its existing expectation and panel-mandate tests:

1. Assert the claim-accuracy expectation and hunt brief require a reused-predicate refusal claim to cite documented known gaps and qualify the promise.
2. Assert the emitted `buildPanelMandate` output for claim-accuracy contains the actionable error/fallback and input-kind Must requirements, including documentation, configuration and data. Check the generated output, not only the exported constant.
3. Assert the mandate asks for caller/predicate source and relevant tests, and distinguishes documented residuals from a demand to change policy. Keep existing source-grounding instructions intact.
4. Verify another lens does not receive the claim-accuracy-only hunt checklist; retain existing frozen-map, lookup and mandate tests.

Run the targeted suite using Vitest with we:scripts/lib/__tests__/review-core.test.mjs as the path argument. Add the new assertions before the wording change and record their failure; after the change, the suite must pass. Removing the new checklist must make its mandate assertions fail again. These tests prove instruction delivery, not guaranteed model compliance.

## Proof plan

Record before/after targeted-suite output and the generated claim-accuracy mandate excerpt containing the new checklist. Inspect the rendered instruction as a whole to ensure both Must lines reach the reviewer and no contradictory blanket refusal guarantee was added.

Perform a source-grounded checklist replay against the motivating claim: trace we:scripts/review-set-label.mjs into we:scripts/lib/review-escalation.mjs, cite the documented relocation residual and the matching cases in we:scripts/lib/__tests__/review-escalation.test.mjs, then contrast an unqualified “every contribution change refuses” sentence with a version explicitly bounded by the digest's documented gaps. Record why the first fails the checklist and the second meets its citation requirement. Separately inspect examples missing the error Must line and omitting configuration/data from the input-kind Must line; both must be identified as incomplete. This is a manual rule replay, not a claim of live juror reliability.

Run `npm run check:standards` during implementation and retain its actual result. No forge mutation or live acceptance carry is needed for this checklist change.

## Follow-ups

- Closing the digest's relocation residual requires separate policy/design work; this item neither selects a mechanism nor expands the current carry guarantee.
- The broader already-handles claim-verification proposal in we:backlog/3280-review-lens-an-x-already-handles-this-claim-must-line-cite-t.md overlaps in source grounding but does not replace this specific known-gaps checklist. Avoid duplicating its broader correctness-lens work here.
- Model-compliance measurement can follow if observed reviews still miss this class; do not present wording-presence tests as proof that every future review catches it.

## Done when

1. The generated claim-accuracy mandate contains the reused-predicate known-gaps check and both Must requirements, with scope and limitations as specified above.
2. New assertions in we:scripts/lib/__tests__/review-core.test.mjs fail before implementation, pass after it, and fail when the checklist is removed.
3. The source-grounded replay and standards-check result are recorded, without changing runtime policy or claiming the documented residual is fixed.
