---
bornAs: x2gsr9p
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "791a95f338b860408ea254f16d51be92d05246a3"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2855's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/deliver-item-wrapper.mjs:353` — When a comment justifies an ordering or atomicity choice, require one test that spies on both calls and asserts their order. A review-lens checklist item is the cheapest route, since a lint rule cannot decide this.
2. `we:scripts/operations/deliver-item-wrapper.mjs:330` — Give release primitives an owner-token parameter that is required by default, so a release by resource key alone has to be an explicit opt-out. A lint or write-gate could flag calls to releaseBuildDispatchClaim that pass no owner. Until then, file a follow-up card for the ownership token.
3. `we:scripts/operations/deliver-item-wrapper.mjs:339` — Persist the non-PR hold before publishing settlement, and add a deterministic fault-injection test that stops after each persistence step and runs a daemon tick to assert that redispatch remains excluded.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2855@a538d451018986910658228b551e5b2825fd4b3c

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs` passes with new
   cases (the hold is durable when the run-store settle fires; claim released last) that fail on today's code,
   where `settleDispatchEffect` runs first.
2. **Filed** — the review-lens checklist item (guard 1) and the owner-token card (guard 2) exist as backlog items.

## Design

Premise check (current `main`, `791a95f33`): still valid, not done. The cited lines have drifted — the code is
now `settleTerminal` in `deliverItem` (`we:scripts/operations/deliver-item-wrapper.mjs` ~L330-365).

- **Guard 3 is a real, open gap.** `settleTerminal` calls `settleDispatchEffect(...)` FIRST, then
  `placeBuildDispatchHold`, then `releaseBuildDispatchClaim`. Its comment argues "hold BEFORE release" but
  settlement publishes the outcome before the hold is durable. Harm path: the daemon's `doneWhy` (`we:skills-src/conveyor/build-dispatch-daemon.mjs` ~L349-367) retires a claim on a settled non-PR row, so a crash between settle and hold leaves a settled row + no hold + a retirable claim, and `heldNums` (~L314) no longer excludes the item — it can redispatch.
  Fix: reorder to hold → settle → release (hold only when `hold` is set). Hold-before-release is already in place.
- **Guard 1 (comment-justified ordering needs an order test)** has no test today: no case in
  `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs` (describe at ~L3393) asserts the order of hold,
  settle and release. Add spy-based cases. The review-lens checklist wording lives outside this item's scope.
- **Guard 2 (owner token on release)** is already documented as a KNOWN GAP in
  `we:scripts/conveyor/build-dispatch-claim.mjs#releaseBuildDispatchClaim`, which says closing it touches four
  files (daemon tick, `dispatch-lane` boundary, wrapper launch payload, claim module). That is far outside this
  item's `scope:`; the guard itself says to file a follow-up card. So the Must here is only filing that card.

Scope check: the two scoped files (wrapper + its test) fit the Musts below; unchanged.

## MVP

Musts only:
1. Reorder `settleTerminal` so the hold is placed before `settleDispatchEffect`, and the claim release stays last.
2. Order-spy tests for that sequence (see Test plan).
3. File the owner-token card and the review-lens checklist card listed under Follow-ups (filing only).

OUT of scope (see Follow-ups): implementing the owner-token change, the review-lens checklist edit, a write-gate/lint rule.

## Test plan

Added to the `deliverItem (#4349 …)` describe in `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`. The claim/hold functions are the real ones under `WE_COORDINATION_ROOT`; order is recorded by a `vi.mock` of `we:scripts/operations/deliver-item-settle.mjs` (wrapping the original `settleDispatchEffect`) whose spy reads `listBuildDispatchHolds()` at the moment settle fires.
- **hold durable when settle fires** — for a `not-ready` finish, the settle spy sees item 9001 already in `listBuildDispatchHolds()`. RED today: settle is called before the hold is placed.
- **claim still present when settle fires, absent after** — pins hold → settle → release (green today for release-last; guards the reorder).
- **no hold → settle and release still happen** (PR outcome / `hold` null) — regression guard.
- A true crash-between-steps test is deliberately NOT included: each step sits in its own best-effort `try/catch`, so a throwing spy is swallowed and proves nothing; a real kill needs a child-process harness (Follow-up). "Hold durable at settle time" is the deterministic stand-in: if the hold exists whenever settle runs, a crash at any later point leaves the item excluded.

## Proof plan

1. Before: run the new tests on `origin/main` code — show the hold-durable-at-settle case failing.
2. After: same command green; also the full wrapper test file and `we:scripts/operations/__tests__/deliver-item-settle.test.mjs`.
3. Probe: a small node script with a temp `WE_COORDINATION_ROOT` driving a `not-ready` finish with a settle stub that prints whether the hold exists when it fires — `false` before the change, `true` after.

## Follow-ups

- File: owner-token parameter for `releaseBuildDispatchClaim`/claim release (required by default; opt-out
  explicit) threaded through daemon tick → dispatch-lane → wrapper launch payload; add a lint/write-gate flag for
  owner-less release calls. (Guard 2.)
- File: add "comment justifies an ordering/atomicity choice → needs an order-spy test" to the review-lens
  checklist (converge/jury lens config). (Guard 1, checklist half.)
- File: CAS semantics for `applyPendingEffects`'s post-sink write (already named in `we:scripts/operations/deliver-item-settle.mjs`).
- File: child-process kill-point harness for `settleTerminal` (true crash-between-steps test with a real daemon tick).
