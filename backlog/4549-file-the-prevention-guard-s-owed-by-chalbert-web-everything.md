---
bornAs: x1dgehb
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "df78eef6655e73cff3c5b98fe14fefa52379059e"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3008's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Add the review-lens checklist alternative requested by the approval: every new durable-claim path needs tests for acquisition, release on completion, and release on failed launch. The current rendered checklist belongs in `we:scripts/lib/review-core.mjs`.
2. Add a deterministic regression in `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` connecting the daemon's emitted dispatch inputs to model resolution against a non-Sonnet routing-table default. Preserve today's shared-policy routing contract.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3008@ec409f2d6bbea5a99ea4e07b3264b4433584691a

## Progress

Preparation research (2026-10-02; no stamp applied):

- **Old premise/scope:** the approval cited `we:skills-src/conveyor/build-dispatch-daemon.mjs:322`, proposed either branch coverage or a review checklist for durable claims, and requested emitted-model-argument regression coverage. Scope named only the daemon and its test.
- **Corrected premise:** that line now sits in settled-run bookkeeping. Build claim acquisition/failure release is at `we:skills-src/conveyor/build-dispatch-daemon.mjs:423`; prepare acquisition/failure release is at `we:skills-src/conveyor/build-dispatch-daemon.mjs:607`; prepare completion release is at `we:skills-src/conveyor/build-dispatch-daemon.mjs:581`. These are existing behaviors to protect, not missing implementation to recreate.
- **Routing drift:** commit `0f7bbc5c7b15855eafa220c82311b88f91edfd84` introduced shared operation policy. `cliDispatch` at `we:skills-src/conveyor/build-dispatch-daemon.mjs:858` now forwards `routingPolicyEnv()` and inherited agent arguments; it emits no dedicated model override. Its nearby comment still describes an override and needs correction. The model test must protect policy forwarding and downstream selection, not restore the obsolete Sonnet pin.
- **Existing evidence:** `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` already has durable build/prepare lifecycle tests, including failed dispatch, completion, dry-run, restart and stale-attempt cases. Its “dispatch shell leaves model selection to the shared policy resolver” case checks the argument/environment shape but does not resolve those captured inputs against a different table default. `we:scripts/lib/__tests__/dispatch-routing-policy.test.mjs` tests downstream selection separately; `we:scripts/operations/__tests__/routing-policy-builder-dry-run.test.mjs` uses a Sonnet table. Neither connects the daemon's captured handoff to a non-Sonnet table.
- **Corrected scope:** retain the daemon/test pair, and add `we:scripts/lib/review-core.mjs` plus its existing matching test `we:scripts/lib/__tests__/review-core.test.mjs`. `buildPanelMandate` already appends `huntBriefForLens(lens)`; `LENS_HUNT_BRIEF` currently defines claim-accuracy guidance but no correctness lifecycle checklist. Use this existing extension point for the explicitly offered checklist alternative. No new coverage threshold or routing policy decision is needed. Shared routing modules are read-only dependencies.
- **Status:** partially covered, not already delivered. The missing checklist and connected regression remain owed. This preparation used source/history inspection; no new test or mutation proof has been executed.

## Design

Add a correctness entry to `LENS_HUNT_BRIEF` in `we:scripts/lib/review-core.mjs`. For every added or changed durable-claim path, require the reviewer to identify executable tests proving acquisition before dispatch, retention while work remains live, release on terminal completion, and release when launch fails (both a returned refusal and a thrown failure where supported). Ask for named tests and observable claim state; an assertion on a summary alone does not prove release. The existing `buildPanelMandate` rendering supplies the checklist to correctness reviewers. Preserve existing lens selection and verdict rules.

In `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`, capture the real `cliDispatch` subprocess argv/environment through its injected `exec`. Isolate and restore routing-related environment variables. Provide a fixed valid policy fixture via a mocked `routingPolicyEnv` boundary, then pass the **captured** snapshot through the real `decideDispatchRoute` and `routeDispatchProvider` exports from `we:scripts/lib/dispatch-contracts.mjs` and `we:scripts/operations/dispatch-lane-io.mjs`. Stub only final launch effects. Supply a non-Sonnet table model that differs from both the fixture's primary and fallback models, so accidentally using the table is observable.

Cover ordinary prepare dispatch and `prepareFallback: true`. Assert absence of daemon-invented model arguments, snapshot preservation, selected provider and exact model at the launcher, and the fallback environment switch. Include a build control proving the prepare fallback switch does not leak into builds. Keep explicit caller agent arguments intact. Correct the stale override comment in `we:skills-src/conveyor/build-dispatch-daemon.mjs`; do not change routing policy or production claim semantics for this prevention item.

## MVP

1. Extend the existing correctness hunt-brief map and its rendered-mandate tests in `we:scripts/lib/__tests__/review-core.test.mjs`.
2. Add the connected dispatch/model regression to `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`, using fixed policy values rather than today's operator defaults.
3. Audit existing daemon lifecycle cases against acquisition/completion/failed-launch requirements. Add any missing assertion or case in that same test file, checking real temporary claim-store contents and dispatch ordering. Preserve stale-attempt and live-owner retention behavior.
4. Correct the daemon comment and run the targeted tests plus standards checks. Deliver one prevention change with both requested guards.

## Test plan

- **Review source/test pair:** `we:scripts/lib/review-core.mjs` → `we:scripts/lib/__tests__/review-core.test.mjs`. Assert the actual correctness panel mandate contains acquisition, completion-release and failure-release requirements. Assert unrelated lenses do not receive this correctness-specific brief. Inspect existing historical mandate fixtures before updating any snapshot; preserve fixtures intentionally recording pre-change behavior.
- **Daemon source/test pair:** `we:skills-src/conveyor/build-dispatch-daemon.mjs` → `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`. Exercise the connected routing cases above with a non-Sonnet table, deterministic policy and restored environment/module mocks. No live provider, GitHub call, dispatch worker or real lane acquisition is needed.
- For claim lifecycle cases, assert a claim exists at dispatch time, survives a successful launch/restart, disappears on current-attempt completion or failed launch, and remains on stale completion/failed observation. Reuse existing fixtures and real temporary claim storage.
- Run both targeted Vitest files from the WE root, then `npm run check:standards`. Also run the read-only downstream routing suites `we:scripts/lib/__tests__/dispatch-routing-policy.test.mjs` and `we:scripts/operations/__tests__/routing-policy-builder-dry-run.test.mjs` to distinguish fixture mistakes from handoff regressions. Their production-default assertions are supporting checks, not substitutes for the new deterministic fixture.

## Proof plan

1. Add the mandate test before adding the brief: it must fail because the rendered correctness mandate lacks the lifecycle checklist, then pass after the brief is wired. This is the executable before/after criterion.
2. Demonstrate routing regression sensitivity with temporary mutations: remove snapshot forwarding, inject a hardcoded Sonnet model argument, and select the table model instead of the policy route, one at a time. Each relevant assertion must fail. Restore mutations and rerun the targeted suite. Existing routing behavior may already pass the new test; mutation failure proves prevention value.
3. Temporarily bypass acquisition and each relevant completion/failed-launch release, separately. Record which lifecycle case detects each mutation; add coverage only for uncovered cases. Restore all mutations before final checks.
4. Record commands, exit statuses, selected provider/model values and test names in the delivery evidence. Distinguish deterministic boundary proof from a live-provider exercise; this item adds guards to an existing path and makes no new live-launch claim.

## Done when

Both guards are present: correctness reviewers receive the explicit durable-claim checklist, and the daemon handoff regression proves primary/fallback model selection against a distinct non-Sonnet table default. The tests named above pass, the checklist test is demonstrated red before implementation, the routing/lifecycle mutations are caught, and the standards check passes. No routing default or claim-retirement policy changes are included.

## Follow-ups

No additional work is required to satisfy the approval debt. A numerical branch-coverage threshold is an alternative from the original review, not an additional obligation after delivering the checklist. If mutation probing reveals a production lifecycle defect, record its exact failing case and handle that behavioral correction explicitly rather than silently widening this prevention change. Any subsequently discovered fixture file that must change must be added to scope before implementation.
