---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "87e4e0fca02216933ed891c2ccd1c65d2495a6ee"
tags: []
---

# Prevention — When a card changes a promotion invariant, a card-lint or review lens should grep for other consumers o… (from chalbert/web-everything#3557 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xul2kwr-a-pr-drafted-as-withdrawn-stays-a-draft-promote-draft-must-n.md:5` — When a card changes a promotion invariant, a card-lint or review lens should grep for other consumers of the same predicate (here `isDraft` plus green rollup) and require each in scope or explicitly excluded. Cheapest is a review-lens checklist item, since this is not script-decidable.
2. `we:backlog/xul2kwr-a-pr-drafted-as-withdrawn-stays-a-draft-promote-draft-must-n.md:28` — Require the card's test plan to enumerate every output state of the function being changed (a table of derived state against withdrawal label present). A review lens is the practical guard.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3557@a0469756ac50ade1a5da0f1e1fb72739539f92d5

## Progress

- Original premise/scope: the approval prevention pointed only to we:backlog/xul2kwr-a-pr-drafted-as-withdrawn-stays-a-draft-promote-draft-must-n.md, with historical line 5 (scope) and line 28 (test-plan concern). Those are review provenance, not current implementation locations; the card is now resolved and substantially expanded. The prevention goal is still a reusable review guard, not another withdrawal implementation.
- Corrected premise/scope: change the executable review-lens instructions in we:scripts/lib/review-core.mjs and their matching existing tests in we:scripts/lib/__tests__/review-core.test.mjs. The existing preparation checklist at we:agent-memory-src/story-preparation-checklist.md:13 already asks for import and subprocess consumers, but does not specifically require same-predicate consumers or exhaustive output-state coverage.
- Current source evidence: we:scripts/conveyor/reconcile-core.mjs:1646 guards green-draft planning; we:scripts/operations/promote-draft-pr-dispatch.mjs:193 checks fresh withdrawal labels; we:scripts/conveyor/review-status-tag.mjs:163 preserves withdrawal in the shared label-change planner. These now implement the motivating fix. They are research evidence, explicitly excluded from this prevention's implementation scope because no runtime behavior change is needed.
- Review seam: we:scripts/lib/review-core.mjs:1922 defines `LENS_HUNT_BRIEF`, currently only for claim-accuracy; we:scripts/lib/review-core.mjs:1119 appends that brief to panel mandates. The final validator at we:scripts/lib/review-core.mjs:1205 builds its own mandate without the hunt brief. Existing brief tests start at we:scripts/lib/__tests__/review-core.test.mjs:1792.
- Read-only preparation probe: importing the real review module and calling `huntBriefForLens('correctness')` returned an empty string; the generated correctness panel mandate did not contain “promotion invariant”. Source inspection confirms neither requested checklist is present at the hunt-brief seam. This is baseline evidence, not evidence of future reviewer effectiveness.

## Design

Add a correctness entry to `LENS_HUNT_BRIEF` in we:scripts/lib/review-core.mjs, using the review-lens option explicitly recommended by the original approval. Semantic equivalence between predicates requires judgment; do not introduce a regex card-lint that pretends to decide it.

The brief applies when a card or diff changes a promotion invariant. Require the reviewer to:

1. Identify the invariant and search its predicate names, labels, and effects across planners, executors, and state writers, including import and subprocess callers. For the motivating example, search `isDraft`, green-check conditions, `draft-withdrawn`, and promotion/status-label effects rather than only the changed function's importers.
2. Produce a consumer inventory with repository-prefixed source citations. Each relevant consumer must be in the card's scope with a matching test path, or explicitly excluded with a source-backed reason why its behavior is already compatible. A search miss is not proof of no consumers; inspect equivalent predicates and label writers.
3. Require the test plan to enumerate every reachable output state of the changed function, including null/no-op/refusal results, crossed with withdrawal-label presence/absence where applicable. Name the input that reaches each row, expected output/effect, and matching test; justify unreachable combinations. Do not substitute one happy-path test for the table.
4. Ground findings in an actual omitted consumer or missing reachable state and its consequence. A reviewer unable to inspect source must report the limitation, not invent a successful search or proof of exhaustiveness. Preserve the existing finding and disposition contracts.

Keep one copy of these instructions. The existing panel builder already appends the selected brief. Append the same selected brief in `buildValidatorMandate` in we:scripts/lib/review-core.mjs so the independent final validator receives the guard too. Preserve signatures, return types, lens selection, and verdict policy. Other lenses retain their own briefs; this does not add a new mandatory seat. No runtime promotion module or historical card needs editing.

## MVP

- **Must 1:** correctness panel and final-validator mandates both carry the same-predicate consumer search and scope-or-reasoned-exclusion requirement.
- **Must 2:** both mandates require all reachable output states, including null/no-op/refusal, and the applicable withdrawal-present/absent matrix with named tests.
- **Must 3:** missing source access or inconclusive search is reported as a limitation, never as verified completeness. The guard applies to promotion changes in source, docs, config, or data cards; file type alone is not an exemption.
- **Must 4:** existing lens routing and finding severity/disposition remain unchanged; no semantic card-lint or GitHub mutation is added.

Build order: add failing mandate regressions, author the correctness brief, wire the validator to the selected brief, then run focused tests and review the generated text. Land as one bounded change with tests. Size 3 remains appropriate for two mandate consumers plus a manually checked motivating-case replay.

## Test plan

Extend we:scripts/lib/__tests__/review-core.test.mjs at its existing hunt-brief and validator suites. Assert the correctness brief is registered, nonempty, and returned through the existing lookup; assert both generated mandates include it exactly once. Verify concrete obligations (predicate search, scope/exclusion evidence, complete output matrix, named test paths, source-access limitation) rather than only a section heading. Retain unknown-lens fallback, invalid-lens rejection, and claim-accuracy tests; assert an unrelated lens does not inherit the correctness checklist.

Use the motivating case as a review exercise, without modifying its files: an executor-only scope must lead the checklist reader to the planner and label writer; a test plan covering only `awaiting-ci` must be incomplete. Derive the reference rows from we:scripts/conveyor/review-status-tag.mjs:92: `needs-human`, `reviewing`, `review-stalled`, `draft-scope-change`, `draft-withdrawn`, `fixing`, `fixing-conflict`, `fix-stalled`, `fixing-conflict-stalled`, `healing-ci`, `ci-heal-stalled`, `awaiting-ci`, and null. Cross these with an existing withdrawal label at `planStatusLabelChange`: present preserves withdrawal; absent follows the derived status or clears stale status on null. This is a reviewer exercise, not new runtime-test scope.

## Done when

1. The new mandate regressions fail against the preparation baseline and pass after implementation: `npx vitest run we:scripts/lib/__tests__/review-core.test.mjs` (remove the `we:` locus prefix to execute from this checkout).
2. Rendered correctness panel and validator mandates contain both obligations exactly once, while unrelated lenses retain their existing behavior.
3. The motivating-case exercise records the omitted consumers and every reference output row, with evidence-backed exclusions for consumers needing no changes. Merely printing the checklist does not establish that a reviewer followed it.

## Proof plan

Capture before/after focused-test output and generated panel/validator text using the real exported builders from we:scripts/lib/review-core.mjs. Temporarily remove the correctness brief and then the validator append independently; the corresponding regressions must fail, restoring each mutation immediately. Record the manual motivating-case inventory and output matrix separately from automated prompt-wiring proof; do not claim an autonomous review success from string assertions. Run `npm run check:standards` after implementation and report actual failures without weakening gates. No live PR, label, or review publication is required.

## Follow-ups

- Observe subsequent promotion-invariant reviews for actual consumer-search and output-matrix evidence; mandate tests guarantee delivery of instructions, not reviewer compliance.
- Consider deterministic lint only if a later concrete omission has a decidable structural signature. General predicate equivalence remains a review judgment, outside this slice.
- Runner owns preparation stamps, checks, and the parked review. This preparation does not implement the guard or claim independent-review approval.
