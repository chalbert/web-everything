---
bornAs: xt3rawp
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "9642ad4574b3e08a446e2fd95889caa79f4faaa8"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2960's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Add an exhaustive held-reason classification and telemetry regression test in `we:scripts/conveyor/__tests__/tick-core.test.mjs`, consuming `HELD_REASONS` from `we:scripts/readiness/dispatch-plan.mjs:172` and exercising `planTick` from `we:scripts/conveyor/tick-core.mjs:1188`. Every token must be explicitly accounted for, and every non-excluded reason must remain visible. This preserves the prevention goal of refusing an unclassified vocabulary addition without introducing a new suppression policy.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2960@cc6d46fe91c1e4d57e868878289ccd3753767ec9

## Progress

- Original premise/scope: the review cited `we:scripts/readiness/dispatch-plan.mjs:564`, scoped only that producer and `we:scripts/readiness/__tests__/dispatch-plan.test.mjs`, and described an excluded-or-transient partition. That citation now falls inside dispatch planning, not tick telemetry.
- Corrected premise/scope: the vocabulary is at `we:scripts/readiness/dispatch-plan.mjs:172`; lifecycle exclusions are at `we:scripts/conveyor/tick-core.mjs:166`; the generic held-note loop is at `we:scripts/conveyor/tick-core.mjs:1595`. Keep the producer and its matching existing test in scope as the dependency under guard; add the consumer and its matching existing test. Expected implementation edits are test-only in the consumer test.
- Source evidence: `we:scripts/conveyor/__tests__/tick-core.test.mjs:1389` covers selected held reasons and lifecycle exclusions, but does not iterate the producer vocabulary. `we:scripts/readiness/queue-report.mjs:99` explicitly rejects unknown classifications; it is precedent, not an additional edit target.
- Preparation probe: imported the current producer and consumer and passed each of the 15 vocabulary tokens separately through `planTick`, substituting lane 17 for the overlap placeholder. All nine non-excluded tokens emitted exactly one generic held note; all six exclusions emitted zero. No transient suppression list exists in this path. The missing deliverable is exhaustive regression coverage, not a currently missing note. The original two-way assertion would incorrectly reject ordinary visible holds such as `blocked` and `already-done`.

## Design

Add a test-local, explicit expected classification table in `we:scripts/conveyor/__tests__/tick-core.test.mjs`. Its six lifecycle entries are `needs-slice`, `needs-decision`, `needs-investigation`, `needs-prepare`, `unshaped-no-scope`, and `no-size`. Its nine generic-note entries are `already-done`, `blocked`, `branch-drift-blocked`, `no free lane`, `capacity-cap`, `overlaps lane-<n>`, `cleared-but-not-ready`, `dispatch-paused`, and `pr-limit`.

Assert exact set equality between the table keys and imported `HELD_REASONS`, plus equality between its lifecycle entries and imported `HELD_NOTE_EXCLUDED_REASONS`. Do not derive the expected table by subtracting exclusions from the vocabulary: that would silently accept every new token. No token is silently transient today; waiting reasons retain their existing notes.

For every vocabulary token, invoke `planTick({ state, plan, bookkeeping })` with empty queue/lanes/PRs, an empty launch list, one held entry with a fixed item number, and tick zero. Materialize `overlaps lane-<n>` as `overlaps lane-17`. Inspect `result.decisions.notes`: generic entries must produce exactly one matching `kind: 'held'` note preserving number, reason, and text; lifecycle entries must produce zero generic notes for that item. Existing lifecycle tests continue to cover dedicated actions/notes. No runtime API, dispatch policy, persistent state, or caller migration changes.

## MVP

1. **Must 1:** Add the explicit exhaustive classification table and vocabulary/exclusion equality assertions in `we:scripts/conveyor/__tests__/tick-core.test.mjs`.
2. **Must 2:** Exercise every token through the real `planTick` and assert the generic-note behavior described above, including concrete overlap rendering.
3. **Must 3:** Demonstrate that the guard detects both an unclassified vocabulary addition and a lost generic held note; retain existing lifecycle coverage.

Deliver as one test-only change. Size 3 remains appropriate for the bounded cross-module regression and mutation evidence. Production classification refactoring and new suppression rules are outside this MVP.

## Test plan

Run the affected Vitest suites for `we:scripts/conveyor/__tests__/tick-core.test.mjs` and `we:scripts/readiness/__tests__/dispatch-plan.test.mjs`. Name the new test group `held-reason vocabulary coverage` so it can be selected independently. Include equality diagnostics that identify missing/extra tokens rather than only comparing counts. Each source in scope has its existing matching test listed in scope.

## Proof plan

During implementation, record the focused group's passing result, then perform two temporary mutations independently: append an unclassified token to `HELD_REASONS` in `we:scripts/readiness/dispatch-plan.mjs`, and skip `pr-limit` in the generic-note loop in `we:scripts/conveyor/tick-core.mjs`. The first must fail classification equality; the second must fail note visibility. Restore each mutation immediately and rerun green. These mutations provide the red/green proof for a missing test guard whose existing runtime behavior already works. Run `npm run check:standards` after the restored suites pass. Record commands, failures, and restored results in the delivery evidence; no live dispatch or agent spawn is required.

## Done when

1. Must 1: exact vocabulary and exclusion equality assertions pass and an unclassified added token fails the new group.
2. Must 2: all 15 current vocabulary entries traverse `planTick`; nine preserve one generic note and six avoid duplicate generic notes, with overlap tested using a concrete lane number.
3. Must 3: suppressing `pr-limit` makes the new group fail, and both affected suites pass after restoration. The focused executable is Vitest with the name filter `held-reason vocabulary coverage` against `we:scripts/conveyor/__tests__/tick-core.test.mjs`; run from the WE root using the repository-relative filesystem path after removing the documentation prefix.
4. The standards gate passes and the final implementation diff contains no temporary mutations or runtime policy changes.

## Follow-ups

No additional work is required for this guard. Future vocabulary additions must deliberately update the expected classification and behavior assertions. A future request to suppress transient holds would require its own explicit policy decision; this item does not introduce that behavior. The runner owns preparation stamping/checks and the parked independent review; this preparation does not claim independent acceptance.
