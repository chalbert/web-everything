---
bornAs: x1wbn1u
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/dispatch-lane-io.test.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/operations/dispatch-eligibility.mjs", "we:scripts/operations/__tests__/dispatch-eligibility.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "2252451f641990568d13fe0ed9bd9f1e179afd48"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3098's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Give the held and planned `readTick` results the same key set, and guard their consumption by `shapeDispatchRead` and dispatch eligibility.
2. Use the same caller-supplied `expectedWithinMinutes` for the early hold and final shaping, retaining the existing shared `dispatchStillHolds` predicate.
3. Pin the existing post-planning in-flight recheck with a regression test that introduces a live row during `runNode`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3098@50fff0eabb898d19559a09109e3420919960ef05

## Progress

Preparation research corrected the original premise and scope:

- The original citations to we:scripts/operations/dispatch-lane-io.mjs:329, :334 and :567 described the held return, hold decision and late recheck. Current evidence is we:scripts/operations/dispatch-lane-io.mjs:337–340 (eight-key early return), we:scripts/operations/dispatch-lane-io.mjs:531–580 (full planned return, including the second store read at line 575). The second read is already implemented; this part owes a prevention test, not a new recheck.
- The hold predicate already exists in we:scripts/operations/dispatch-lane.mjs:704. Both readers use it, but the early call omits options while `shapeDispatchRead` passes the normalized caller estimate at we:scripts/operations/dispatch-lane.mjs:894. The declaration at we:scripts/operations/dispatch-lane.mjs:1241 and eligibility reader at we:scripts/operations/dispatch-eligibility.mjs:27 omit that estimate when calling the reader. The bound reader at we:scripts/operations/dispatch-lane-io.mjs:1059 also drops per-call estimates. Scope therefore includes these forwarding sites and their matching tests; no new hold policy is needed.
- Original scope named we:scripts/operations/__tests__/dispatch-lane-io.test.mjs as though it existed. It does not; retain it as the **planned** focused reader regression suite. Existing reader tests live in we:scripts/operations/__tests__/dispatch-lane.test.mjs:1936. The existing disk-backed hold/settlement test in we:scripts/operations/__tests__/dispatch-lane-integration.test.mjs:143 already proves planner avoidance and recovery, but not raw key parity or caller-timeout forwarding. The existing held-item fixture in we:scripts/operations/__tests__/dispatch-eligibility.test.mjs:45 can be extended rather than inventing a second eligibility harness.

The goal is not already delivered: the two raw return shapes still differ and the timeout forwarding gap remains visible in the current source.

## Design

Keep `dispatchStillHolds` as the sole hold predicate. Add `expectedWithinMinutes` to `readTick`, with the existing default, and pass it to the early predicate. Forward the same input through `dispatchLaneOperation`, `dispatchEligibilityOperation`, `createTickReader`, and the recursive per-item reads for `all: true`. Keep current deadline, liveness and grace semantics unchanged.

Give the early and planned raw reads one explicit return contract in we:scripts/operations/dispatch-lane-io.mjs. Share default field construction so the early return includes every key exposed by the planned return. Use honest empty values for information not read: null admission/item/routing/launch metadata, empty brief/status strings and notes, and the existing build fallback for launch kind. Preserve actual bookkeeping, in-flight records and observation time. Key parity does not imply equal values or require running the planner, loading briefs or performing routing IO for a held item.

Keep the second in-flight lookup after planning. It observes a dispatch arriving during the planner call and must supersede the initially empty snapshot. Feed both raw paths through the real `shapeDispatchRead`; compare held and eligible shaped key sets separately from raw key sets.

## MVP

1. Implement the shared raw result defaults and estimate forwarding in the three scoped source modules.
2. Add we:scripts/operations/__tests__/dispatch-lane-io.test.mjs for key parity, held-path laziness, custom timeout agreement, bound-reader/whole-queue forwarding and the late-arrival regression.
3. Extend we:scripts/operations/__tests__/dispatch-lane.test.mjs to assert the operation forwards its estimate, and we:scripts/operations/__tests__/dispatch-eligibility.test.mjs to exercise a real held reader through eligibility and pin its estimate forwarding.

## Test plan

- Freeze time; inject all IO, including store lookup, liveness persistence, agent listing, item/brief loading, already-done checks and routing inputs. No live agent or GitHub access is needed.
- Compare sorted `Object.keys` for held and planned raw reads; then compare held and eligible shaped reads. Assert held values remain non-dispatching, with an in-flight gate and no fabricated admission evidence. Spies must prove the held path skips planning and downstream IO.
- For unknown liveness and no recorded deadline, choose timestamps between a short caller estimate plus grace and the default estimate plus grace; repeat with a longer estimate. Assert reader and shaper agree on holding versus reaching the planner. Cover default/invalid estimates and retain live-session holding regardless of elapsed time.
- Start the in-flight provider empty. In the `runNode` fake, introduce a live row. Assert two store reads, the second row in `inFlightDispatches`, and `shapeDispatchRead` refusing the otherwise eligible launch.
- Run held-item eligibility through its existing engine harness: `eligible: false`, first blocking gate `in-flight-dispatch`, liveness/count evidence preserved, no planner call for a single held item. Cover custom estimates for both single-item and whole-queue reads.

## Proof plan

The builder runs the focused Vitest suites for we:scripts/operations/__tests__/dispatch-lane-io.test.mjs, we:scripts/operations/__tests__/dispatch-lane.test.mjs, we:scripts/operations/__tests__/dispatch-eligibility.test.mjs and the existing we:scripts/operations/__tests__/dispatch-lane-integration.test.mjs. Use `npx vitest run` with those WE-relative paths after removing only the `we:` reference prefix.

Record red/green evidence: the new raw-key-parity and timeout-forwarding tests must fail against the pre-change implementation and pass after implementation. The late-arrival test should pass today; demonstrate its prevention value by temporarily replacing the final lookup with the first snapshot and observing failure, then restore the implementation. Run `npm run check:standards` after the completed implementation. Preparation itself changes only this card; implementation tests and these proof runs remain owed by the builder.

## Done when

All focused suites above and `npm run check:standards` pass; held/planned key contracts, shared timeout inputs, eligibility reporting and late-arrival protection have executable assertions with the recorded failure evidence described above.

## Follow-ups

No prerequisite judgment call remains. Atomic exclusion between the final lookup and spawning is outside this prevention item: the regression proves observation of arrivals during planning, not an atomic dispatch lock. Any broader concurrency change needs separate evidence and scope.
