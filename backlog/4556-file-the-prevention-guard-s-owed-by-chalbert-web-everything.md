---
bornAs: x8gnz15
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/__tests__/dispatch-plan*.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "a14570913daa49462b55b2a7d27729c04b286fa4"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3011's independent review

Close the independent review's prevention debt: prove that a real backlog-loaded, unprepared candidate reaches preparation planning, and prevent card-declared launch kinds from bypassing build readiness gates. The approval did not waive these guards.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3011@a6530b7cc3def9271ea09c3710b48e5a65f5f635

## Progress

- Original premise/scope: the review cited preparation and size exemptions at we:scripts/readiness/dispatch-plan.mjs:584 and :582 and requested a real queue-path regression plus item-kind validation. Scope covered that source and only we:scripts/readiness/__tests__/dispatch-plan.test.mjs.
- Corrected evidence: exemptions now live at we:scripts/readiness/dispatch-plan.mjs:578 and we:scripts/readiness/dispatch-plan.mjs:604; the production row mapping at we:scripts/readiness/dispatch-plan.mjs:892 copies card `kind` at line 899. The loader is invoked at we:scripts/readiness/dispatch-plan.mjs:848. Existing tests at we:scripts/readiness/__tests__/dispatch-plan.test.mjs:759 construct launch-kind rows directly, including `prepare-item`, rather than proving the production mapping.
- The actual route is `cliPlanTick` in we:skills-src/conveyor/build-dispatch-daemon.mjs:715 → the shell in we:scripts/conveyor/tick-core.mjs:1927 → the build planner. Preparation candidates come from `needs-prepare` holds at we:scripts/conveyor/tick-core.mjs:1256 and are emitted as `spawnPrepareItems` at we:scripts/conveyor/tick-core.mjs:1693. They do not need to masquerade as card kinds in the build queue. Fix and CI-heal spawns also have separate tick paths.
- The canonical enum already exists as `BACKLOG_KINDS` in we:scripts/check-standards-rules.mjs:234; its static validation at we:scripts/check-standards-rules.mjs:384 is not a runtime queue boundary. Its six values exclude `prepare-item`, `fix`, and `ci-heal`.
- Observation during preparation: a direct Node probe of the current `dispatchPlan`, with identical scoped, sized, unstamped rows and both readiness policies enabled, held `story` as `needs-prepare` but launched each of `prepare-item`, `fix`, and `ci-heal`. This proves the core bypass remains; it does not claim a live daemon exploited it.
- Corrected scope: retain the single production source, and widen its matching tests to we:scripts/readiness/__tests__/dispatch-plan*.test.mjs so a dedicated backlog-load integration test can accompany the existing unit suite. The loader and tick core are exercised dependencies, not planned edits. The goal is not already delivered. No new scheduling policy is required: enforce the existing item-kind vocabulary and existing separate preparation route.

## Design

Keep backlog item kind separate from scheduler launch kind. `dispatchPlan` schedules builds; validate every explicitly supplied queue `kind` against the canonical `BACKLOG_KINDS` before admission. Reject invalid values with a diagnostic TypeError identifying the item and invalid kind, without returning any launch plan. Preserve the existing missing-kind fallback for loader failure and legacy direct callers; absence must confer no exemption.

Remove the `prepare-item`, `fix`, and `ci-heal` exemptions based on `item.kind` from we:scripts/readiness/dispatch-plan.mjs, including the misleading contract comments. Do not add a card-controllable `launchKind` exemption: genuine preparation/fix/heal scheduling already occurs separately in we:scripts/conveyor/tick-core.mjs. Keep existing hold precedence, sizing rules for tasks/stories, lane admission, and stamp-format semantics for valid backlog kinds.

Extract the current rows-plus-loaded-items mapping into an exported pure helper within we:scripts/readiness/dispatch-plan.mjs and use it in the production shell. Preserve its explicit field projection, scope normalization and missing-item behavior; never spread arbitrary frontmatter into planner inputs. This gives the regression access to the actual production mapping rather than a second handwritten copy. Validate in the core as well so direct callers cannot evade the boundary.

## MVP

1. Add runtime item-kind validation using the existing enum and remove launch-kind exemptions in we:scripts/readiness/dispatch-plan.mjs.
2. Extract and wire the production queue mapping in that same source. Do not change the backlog loader, tick scheduler, launch routing, or enum.
3. Update we:scripts/readiness/__tests__/dispatch-plan.test.mjs to replace launch-kind-as-item-kind expectations with rejection assertions and preserve valid-kind readiness/precedence coverage.
4. Add we:scripts/readiness/__tests__/dispatch-plan-backlog-load.test.mjs, loading temporary Markdown cards with the real backlog loader, using the production mapping and `dispatchPlan`, then feeding its real result to `planTick`. Assert an unprepared story is absent from build launches and present in `spawnPrepareItems` when capacity is available.

## Test plan

- In we:scripts/readiness/__tests__/dispatch-plan-backlog-load.test.mjs, isolate `WE_BACKLOG_DIR` and the CommonJS loader cache, restore them after each test, and clean temporary files. Use fixed clock, empty leases/PRs/bookkeeping, available lanes, and explicit size/prepare policies. No network, workers, claims, or live queue writes.
- Load a scoped size-3 story with no stamp: verify the mapped `kind` remains `story`, the build plan holds `needs-prepare`, and `planTick` emits exactly that candidate in `spawnPrepareItems`, never `spawnBuilds`. A stamped sibling is eligible for build and not preparation.
- Load cards declaring each of `prepare-item`, `fix`, and `ci-heal`; run the same production mapping and assert runtime rejection. Repeat with no size and with a valid size to show neither gate can be bypassed. A valid story carrying frontmatter `launchKind: prepare-item` must still hold `needs-prepare`; the mapper must not copy that field.
- In we:scripts/readiness/__tests__/dispatch-plan.test.mjs, cover all six valid enum values, an unknown explicit kind, absent kind, and unchanged blocked/grouping/decision/investigation/scope/size/prepare precedence. Keep genuine preparation's pause/capacity behavior covered by the existing we:scripts/conveyor/__tests__/tick-core.test.mjs suite.

## Proof plan

Run the new focused regressions against the baseline first: rejection assertions must fail on today's exempt launch-kind rows. The positive backlog-to-preparation test may already pass; retain it as the missing seam guard, not as evidence of a previously broken preparation route. After implementation, run both focused test files and the existing tick-core suite; record commands, exit status and assertion results. Reverting only runtime validation/exemption removal must make the bypass regressions fail again.

Use `npx vitest run` with we:scripts/readiness/__tests__/dispatch-plan.test.mjs, we:scripts/readiness/__tests__/dispatch-plan-backlog-load.test.mjs and we:scripts/conveyor/__tests__/tick-core.test.mjs (strip the repository prefixes when passing local filenames). Run `npm run check:standards`. The temporary-card test must execute the real loader and production mapper; a source-text grep or prebuilt `needs-prepare` plan is insufficient proof.

## Follow-ups

None required for this prevention guard. Stronger preparation-stamp provenance, broader malformed-card validation and scheduler policy changes remain outside this item. If implementation discovers another production caller using launch kinds as item kinds, identify its concrete call path and matching test and correct scope before proceeding; do not silently restore a frontmatter-based exemption.

## Done when

The backlog-load regression proves preparation remains reachable, runtime queue validation rejects launch-kind card values, frontmatter cannot supply an exemption, and the focused regression command plus standards gate pass. Record red/green evidence for the bypass guard; preparation alone does not satisfy this delivery criterion.
