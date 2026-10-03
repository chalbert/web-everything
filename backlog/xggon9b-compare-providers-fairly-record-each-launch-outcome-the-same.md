---
kind: epic
parent: "4376"
status: open
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
preparedAgainstSha: "db98be3296929218431ced01a9ca0982b5f8f5c5"
tags: []
scope:
  - "we:scripts/conveyor/run-scorecard-store.mjs"
  - "we:scripts/conveyor/run-quality-record.mjs"
  - "we:scripts/conveyor/run-rating.mjs"
  - "we:scripts/conveyor/concurrent-baseline-comparison.mjs"
  - "we:scripts/lib/probation-launcher.mjs"
  - "we:scripts/lib/model-probation.mjs"
  - "we:scripts/operations/probation-build-run.mjs"
  - "we:scripts/operations/probation-heal-run.mjs"
  - "we:scripts/conveyor/provider-launch-outcomes.mjs"
  - "we:scripts/conveyor/__tests__/provider-launch-outcomes.test.mjs"
  - "we:scripts/conveyor/__tests__/run-scorecard-store.test.mjs"
  - "we:scripts/conveyor/__tests__/run-quality-record.test.mjs"
  - "we:scripts/conveyor/__tests__/run-rating.test.mjs"
  - "we:scripts/conveyor/__tests__/concurrent-baseline-comparison.test.mjs"
  - "we:scripts/lib/__tests__/probation-launcher.test.mjs"
  - "we:scripts/lib/__tests__/model-probation.test.mjs"
  - "we:scripts/lib/__tests__/model-probation-trials.test.mjs"
  - "we:scripts/operations/__tests__/probation-build-run.test.mjs"
  - "we:scripts/operations/__tests__/probation-heal-run.test.mjs"
  - "we:contracts/provider-comparison.schema.json"
  - "we:contracts/provider-comparison.examples.json"
  - "we:contracts/provider-comparison.test.ts"
---

# Compare providers fairly: record each launch outcome the same way, run a small paired sample, show it in Plateau

Operator, 2026-10-02: "do we have any data on how Claude vs Codex perform?" Goal: comparable evidence per provider, role and task kind; one logical outcome record per launch, a small weekly paired sample judged with the same rubric, and a Plateau comparison view with a machine-readable projection available to routing. Keep the per-launch model and effort attribution motivation from routing PR #3311 (not backlog item #3311).

## Progress

Preparation inspected checkout `db98be329`. This is source inspection, not a fresh production scorecard census or a claim about the deployed Plateau page.

- **Old premise:** about 7,500 records, 99 Codex probation launches without outcomes, 82% of Claude fixes and 90% of heals unclassified, advisory scores always 100. **Correction:** retain those as the original operator investigation's unverified historical observations, not current measurements. The card supplied no reproducible snapshot/query. Current schema rejects score 100 when no criteria were evaluated (`we:scripts/conveyor/run-scorecard-store.mjs:93-95`); it does not establish that all advisory scores are constant. Reproduce population counts with a dated, read-only export before making numerical claims.
- **Old scope:** add outcome recording as if launches had none. **Correction:** probation already records `launchOutcome`, provider/model/effort, task type and identity while deliberately leaving judged `outcome` null (`we:scripts/lib/probation-launcher.mjs:398-428`). Build and heal finish paths call this adapter (`we:scripts/operations/probation-build-run.mjs:265-278`, `we:scripts/operations/probation-heal-run.mjs:91-96`). The judged-launch selector currently selects healed launches with PRs, not every build/prepare launch (`we:scripts/lib/model-probation.mjs:310-320`). Extend lifecycle coverage; do not turn worker completion into proof of landing.
- **Existing evidence is reusable:** generic provider recorders leave outcome null (`we:scripts/conveyor/run-quality-record.mjs:77-103`, `:132-158`); native ratings already expose wall time, outcome, tokens, cost and data-quality fields (`we:scripts/conveyor/run-rating.mjs:1087-1115`). These are different row shapes, not yet the uniform launch projection requested here.
- **Pairing is not greenfield:** the existing comparison command records two already-judged runs linked by a comparison ID; it does not itself judge their diffs (`we:scripts/conveyor/concurrent-baseline-comparison.mjs:197-200`, `:272-275`). Its linked-row test exists at `we:scripts/conveyor/__tests__/concurrent-baseline-comparison.test.mjs:62-76`. Extend that seam for scheduled sample manifests and comparable-card metadata.
- **Corrected delivery boundary:** the WE progress schema is explicitly a declarative contract without collector/UI (`we:contracts/plateau-progress-view.schema.json:3-4`). The documented product boundary assigns collection, aggregation, relay and UI to Plateau (`we:docs/agent/plateau-progress-view.md:9`, anchored in `we:docs/agent/platform-decisions.md#constellation-placement` and `#surface-contract-not-computation`). The scope above is the WE touch set, including proposed outcome adapter and contract/test files; the Plateau consumer is a required separately scoped implementation slice, not a WE UI directory. No claim is made that its current deployed behavior was inspected here.

## Design

Proposed implementation, grounded in the adapters above:

1. Define a versioned launch-outcome contract first. A stable launch ID identifies an actual execution attempt across native and delegated providers; retries get distinct IDs and retain a parent attempt link. Carry repository, card/PR/session, role, task kind, requested and evidenced model, effort, rubric version and observation times. Preserve raw provider identity alongside any explicit display normalization. Unavailable identity stays unknown.
2. Provide **one logical record per launch**, derived from append-only launch, completion and independently observed review/merge evidence. Keep raw historical scorecards unchanged. Repeated observers and concurrent writers must be idempotent by launch/event identity; a later merge updates the projection without erasing earlier rework. The existing locked trial append is precedent, not universal deduplication (`we:scripts/conveyor/run-scorecard-store.mjs:335-363`). Separate launch disposition, review disposition and delivery disposition. Pending/unknown must never become failed or landed through defaulting. Pre-launch refusal is separately counted and must not masquerade as an executed trial.
3. Normalize landed/not-landed/pending/unknown, review rounds to acceptance, rework and stand-down, wall time, tokens, cost and operator interventions. Each measurement carries availability and source evidence. Zero means observed zero; null means unmeasured. Preserve partial pricing and distinguish launch wall time from elapsed time to merge. Attribute review and human-intervention events to a launch only when evidence supports the join; retain ambiguous events as unassigned rather than multiplying them across attempts. Use the same definitions for all providers and roles.
4. Extend the paired harness with a weekly manifest: role/task kind, comparable-card criteria (scope, size, risk, repository and required checks), fixed rubric/version, provider/model/effort, pair IDs, launch IDs and independent judgments. A configurable small cap (initial proposal: two pairs per week) bounds the sample. Record skipped and incomplete pairs. Same-task isolated runs are preferred where practical; matched different cards must explicitly say they are matched, not identical. Each side must pass normal routing eligibility and sandbox restrictions. Weekly reruns must not duplicate paid work.
5. Publish a versioned comparison contract with per-role/task-kind cohorts, model/effort/rubric/time window, sample sizes, missingness, paired versus observational evidence, metric denominators and freshness. Plateau implements collection and the view in its own slice. Display no pooled provider winner across incompatible cohorts. Existing score aggregation already requires rubric/provider/model and excludes null scores (`we:scripts/conveyor/run-scorecard-store.mjs:366-377`); process scores and delivery outcomes remain separate measures.
6. Make the projection readable by routing without changing routing eligibility or promotion thresholds in this epic. Routing already has an explicit policy-read seam (`we:scripts/lib/dispatch-routing-policy-io.mjs:9-38`). Preserve the governed trust predicates and human promotion boundary in `we:docs/agent/platform-decisions.md#delegation-trial-record-graduation` (rules at lines 5041-5058) and `#model-probation-graduation-criteria` (promotion at line 4964). Small samples provide evidence, never an automatic authority grant.

## MVP

Deliver this epic in three reviewable slices, each with its tests:

1. WE contract/examples and launch projection, integrated with current scorecard/rating/probation writers and review observations for build, prepare, fix, heal, required review and advisory review. Include all configured providers through adapters, with explicit unsupported/missing evidence instead of silent omissions. Audit launch-count coverage against an independent launch inventory.
2. Extend the paired harness and add a bounded weekly invocation with a persistent manifest and shared judging rubric. Run one small real sample; record incomplete or ineligible pairs honestly. The harness must retain normal dispatch policy rather than adding an unrestricted launch path.
3. Required Plateau collector/relay/view slice consuming the contract, with its own concrete product paths and unit/browser tests established before implementation. Show role/task filters, denominators, unknowns, costs and provenance, and expose the same projection for a read-only routing consumer. This epic is not complete at the WE schema or CLI stage.

Automatic routing optimization, historical guesses and a statistically conclusive provider ranking are outside this MVP. The present task only prepares this card.

## Test plan

- Add proposed `we:scripts/conveyor/__tests__/provider-launch-outcomes.test.mjs`: a provider-by-role matrix with independent expected outcomes covering start, completion, rejection, stand-down, rework then merge, repeated observer events, distinct retries, colliding PR numbers across repos, ambiguous joins, lost completion and a pending launch. Assert exactly one projected record per actual launch and no fabricated success.
- Extend the existing store, recorder, rating, probation launcher and build/heal tests listed in scope. Exercise the actual adapters into temporary storage; include lock contention/replay, write failure visibility and unavailable/partial token and cost evidence. Preserve legacy rows and probation eligibility behavior.
- Extend paired-comparison tests with repeated weekly invocation, capped dispatch, ineligible provider, a failed second side, unequal rubric/cohort rejection, same-task versus matched-card labeling and independent judgment provenance. No fixture should assert provider superiority just because a process exited zero.
- Add proposed `we:contracts/provider-comparison.test.ts` with schema examples and invalid cases: missing denominators, unsupported version, unknown versus zero, incomparable groups and stale snapshots. The Plateau slice owes collector/relay contract tests plus rendered browser checks for filters, missing data, accessible tables and mobile layout; these are required delivery tests, not waived by the WE scope.

## Done when

1. **Executable:** `npx vitest run` targeting proposed tests `we:scripts/conveyor/__tests__/provider-launch-outcomes.test.mjs` and `we:contracts/provider-comparison.test.ts` (strip the repository prefix when executing) fails before implementation because the contract/projection are absent and passes afterward with the matrix above. Run the existing affected suites listed in scope as well.
2. **Must:** every actual launch in the proof sample has exactly one logical outcome record with evidence and honest unavailable fields; rework, unknown and launch failure remain distinguishable from delivery success.
3. **Must:** one bounded weekly paired sample is persisted, independently judged and displayed in Plateau by role/task kind with sample sizes and missingness; rerunning its invocation does not relaunch completed sample work.
4. **Must:** malformed, stale or incomplete evidence cannot create an earned promotion or bypass dispatch policy. Sampling doc, config and data tasks uses the same eligibility checks as source-code tasks.
5. **Must:** the Plateau consumer and its browser/contract tests ship before resolving the epic. A JSON export alone does not satisfy the requested view.

## Proof plan

Before implementation, capture a dated read-only source inventory through the canonical store resolver (`we:scripts/conveyor/run-scorecard-store.mjs:75`), grouped by provider/model/effort, role/task kind and rubric, with outcome and cost coverage. Keep counts reproducible; do not mutate history to improve apparent coverage.

After implementation, use temporary fixtures first, then observe a bounded real pair through the normal dispatch path. Reconcile both launch IDs against worker records, independently observed review/PR state, usage evidence and the resulting projection. Exercise one unsuccessful or incomplete side and a repeated collection pass. Save the manifest, timestamps, rubric and sanitized evidence references; compare launch counts before/after replay. Render the actual Plateau route, verify cohort counts and unavailable fields against that projection, and exercise the read-only routing consumer without changing a route. Tests are necessary but do not substitute for this live observation. Finish with the lane verifier and the affected product browser/a11y gates.

## Follow-ups

- Establish the exact Plateau implementation/test scope in its delivery slice; use the existing publisher/relay ownership rather than adding product runtime to WE. Record its inspected revision before choosing files.
- Coordinate with the repair-routing follow-on: actual model/effort and launch certainty must agree, not introduce a second routing decision (acceptance intent at `we:backlog/xa7tqgw-route-review-fixes-and-ci-heals-to-codex-split-from-3311.md:47`).
- Add historical backfill only where evidence supports the join; publish unresolved coverage gaps. Broader sampling and any routing-policy change need their own evidence and scope.
- Testing lesson for this delivery: distinguish a writer finishing, a reviewer accepting and a change merging. Preserve unknown and partial data in tests; a constant process score cannot stand in for a delivered outcome. Keep this lesson here rather than editing shared agent documentation.
