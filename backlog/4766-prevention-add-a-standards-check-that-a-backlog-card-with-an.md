---
bornAs: xaevyiv
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/check-standards.contract.json", "we:scripts/lib/__tests__/check-standards.conformance.test.mjs", "we:scripts/__tests__/check-backlog-item.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8b3cb25274eca9818bfec5c6fe898c85368b4fe2"
tags: []
---

# Prevention — Reject unreconciled operator rulings and unfinished readiness criteria

Add a standards guard that makes an operator ruling's authoritative implementation plan explicit and rejects unfinished Must and executable acceptance criteria before a card is ready for build. Preserve historical evidence without leaving two live instructions for the implementing lane.

Filed mechanically on approval of chalbert/web-everything#3477. The review requested superseded or rewritten Fix lines after an Operator ruling, or one authoritative Plan with older instructions marked as history; it also requested concrete error-path and non-code Must lines for refusal-relaxation work and an executable Done-when criterion.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3477@096956089e23a1440449e9b83ce55fc647c62b78

## Progress

Old premise/scope: the approval cited lines 22 and 26 of `we:backlog/4815-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md` and scoped only that card, implying its Must lines remained placeholders. Those citations are stale: the current card has populated Must-on-error and Must-for-non-code lines at 42–43 and a substantive Done-when section at 53. Its Design still prescribes immediate confidence normalization, while its Operator ruling at 65 requires a tool-bearing confirmation turn. A separate embedded Fix instruction remains at 63. Preparation must not adjudicate or rewrite that other card's runtime behavior.

Corrected premise/scope: this is shared backlog-lint work, with the cited card serving as evidence and a synthetic fixture shape rather than the implementation location. `we:scripts/check-standards-rules.mjs` owns `lintBacklogItemRendering`; `we:scripts/check-standards.mjs:932` and `we:scripts/check-backlog-item.mjs` already call it. Existing `findMustWithoutDoneWhen` checks numbered citations only, and `findGuardRelaxationGaps` is a warning-only lexical check of the lead region, stopping at Design, Test plan, or Progress. Neither establishes operator-ruling reconciliation or rejects Must/Executable TODO placeholders. The current test home is `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`, not the former unsplit rules suite.

Observed probe: called `lintBacklogItemRendering` with an open, Tier-A, batchable, prepared story containing conflicting Fix and Operator ruling sections, a Must TODO, and an Executable TODO. It returned empty errors and warnings. This is a synthetic reproduction of the missing guard, not proof about the historical PR. The goal is not already delivered.

Readiness is derived rather than a `status: ready` value: `we:src/_data/backlog.js:476` derives tiers from structured metadata. Use that existing build-readiness signal in the lint; do not add a lifecycle status or change dispatch. Scope now pairs the rules engine with its content-lint tests, its enforcement contract with the existing conformance suite, and includes the existing per-item CLI test for wiring proof. Both callers already share the hook, so their source files need no planned edit.

## Design

1. Add a pure, line-reporting structural detector to `we:scripts/check-standards-rules.mjs`, composed by `lintBacklogItemRendering`. Parse real Markdown headings and instruction lines outside fenced examples and blockquotes. Recognize dated Operator ruling headings, Fix headings, and embedded `Fix:` instructions. A ruling must leave a single current plan: implement the review's explicit fallback of exactly one nonempty `## Plan`, designated authoritative, with prior Design/Fix instruction sections explicitly marked History or Superseded and pointing to that Plan. Permit rewriting by replacing the old instructions with that Plan. Do not claim to determine semantic agreement between arbitrary prose and a ruling. Preserve the ruling text as provenance; a later ruling requires reconciliation of the current Plan again through review.
2. Report unreconciled ruling structure as an error for unresolved cards with an Operator ruling. For unresolved build cards already derived as Tier A, reject TODO or empty Must entries and an absent, empty, or TODO executable Done-when criterion. For other unresolved build cards, surface the same readiness gaps as warnings so preparation remains possible. Resolved history and decision cards are outside the build-readiness check. The existing tier is the readiness input; do not infer readiness from a word in the body.
3. Check Must entries in their actual authored homes: Must sections, bold Must groups under MVP/Explicit MVP cut, and labelled Must bullets in Test plan. Ignore quoted/fenced historical placeholders. When the existing guard-relaxation predicate identifies refusal-loosening work, require substantive error-path and non-code Must entries, explicitly covering docs, config, and data. Reuse its trigger without broadening it into semantic classification; collect the required Must evidence across those sections instead of relying on lead-text keyword presence. Other work needs its own substantive Must criteria but is not required to invent a refusal policy.
4. An executable criterion is a non-placeholder command plus a stated expected outcome in Done when; inspect it as text and never execute a card-supplied command during lint. Diagnostics identify the card, offending line, and repair. Add an enforced flag mirrored in `we:scripts/check-standards.contract.json` and pin it through the existing conformance machinery. Keep existing warning rules and their contract values intact.

## MVP

- **Must 1:** one pure structural detector and shared-lint integration in `we:scripts/check-standards-rules.mjs`, covering ruling reconciliation, unfinished Must entries, and executable acceptance criteria with the applicability above.
- **Must 2:** enforcement declaration in `we:scripts/check-standards.contract.json`, pinned by `we:scripts/lib/__tests__/check-standards.conformance.test.mjs`.
- **Must 3:** regression fixtures in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` and subprocess wiring coverage in `we:scripts/__tests__/check-backlog-item.test.mjs`. Use synthetic card text; do not repair unrelated live cards or implement the cited runtime change.
- **Must on error:** ambiguous or incomplete reconciliation produces an actionable finding; lint treats executable text as data, including malformed or shell-like content.
- **Must for non-code:** docs, config, and data criteria receive the same structural validation as source-code criteria; file type does not exempt a card.

## Test plan

- Capability (RED today): a ruling with live Fix instructions fails; cover both a Fix heading and the incident's embedded `Fix:` line. A Plan without an explicit history/supersession marker, an empty Plan, and duplicate Plans also fail. Extend `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`.
- Capability (RED today): Tier-A stories with missing/empty Must criteria, TODO Must bullets in each supported location, or missing/empty/TODO Executable acceptance fail. Refusal-relaxation fixtures with only one required Must fail; fully populated error and docs/config/data criteria are accepted. Assert exact finding category and line, not total unrelated warning count.
- Preservation (passes on both): a rewritten single authoritative Plan with prior instructions removed, or one with older sections explicitly marked History/Superseded, is accepted. Mutation proof: restore an unmarked older Fix instruction and require rejection. Include a dated ruling and multiple historical rulings with one reconciled Plan.
- Preservation (passes on both): resolved cards, non-ready drafts, decisions, fenced examples, and blockquoted historical TODO text do not acquire hard readiness errors. Mutation proof: make the draft Tier A or move the placeholder into a live Must entry and require rejection. Parameterize source, docs, config, and data; command-like fixture text must create no subprocess or filesystem side effect.
- Capability (RED today): extend `we:scripts/__tests__/check-backlog-item.test.mjs` with an invalid synthetic ruling card that exits nonzero, then rewrite it into the reconciled shape and require success. Clean up the temporary card through the existing harness. Verify whole-repo and scoped callers expose the shared diagnostic. Extend `we:scripts/lib/__tests__/check-standards.conformance.test.mjs` as needed to pin the new flag; mutation proof flips the engine flag alone and makes conformance fail.

## Proof plan

Run the three scoped Vitest suites by their repo-relative paths from the WE root: `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`, `we:scripts/__tests__/check-backlog-item.test.mjs`, and `we:scripts/lib/__tests__/check-standards.conformance.test.mjs`. Record the named new assertions failing on the base and passing on the implementation; current positive controls are not red-to-green evidence.

Use the actual scoped CLI subprocess test to prove exit behavior, not only the pure detector. Run `npm run check:standards` and record any pre-existing corpus findings separately from the new guard's findings. Inventory newly flagged live cards before claiming a green rollout; do not silently weaken enforcement or bulk-edit their decisions to obtain green. No live GitHub writes or runtime review dispatch are required for this guard.

## Done when

**Executable:** from the WE root, run `npx vitest run` with the three suite paths listed in Proof plan (remove the documentary `we:` prefix when passing paths to the shell), then `npm run check:standards`. Musts 1–3 are satisfied when the new regression assertions fail on the base, pass after implementation, the CLI rejects the invalid card and accepts the reconciled card, and contract conformance pins enforcement. Record the actual outputs and any corpus blockers; an unrun command is not completion evidence.

## Follow-ups

Reconcile the cited card's runtime plan in its own implementation lane under its operator ruling; this guard only establishes an explicit authoritative plan and complete criteria. Any corpus migration discovered by the gate needs its own bounded touch-set, not an undeclared expansion here. Semantic consistency between a Plan and the operator's words remains a reviewer obligation. These follow-ups are not filed as separate items during preparation.
