---
bornAs: xoj2vm2
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs", "we:scripts/lib/lane-concurrency.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "3448e52f4a81dd6369438f2249f2958205501632"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2862's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/dispatch-plan.mjs:1039` — Have `dispatchPlan` return `{activeCount, room}` on the plan object, so the printing layer displays the value the core used and does not recompute it. Add a test that a plan with launches plus holds reports room 0.
2. `we:scripts/conveyor/__tests__/tick-core.test.mjs:1704` — Add a deterministic exact-array assertion for the withheld lane IDs to the existing summary-note test.
3. `we:scripts/readiness/__tests__/dispatch-plan.test.mjs:914` — Add table-driven exact-output assertions for negative, undefined, and fractional active counts.
4. `we:scripts/readiness/dispatch-plan.mjs:245` — A mutation testing gate that breaks the clamping logic (e.g., removing the `Math.max(0, ...)` wrapper) and requires a test to fail, ensuring all edge-case branches are covered.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2862@16451f3778a73a6c1ec3a66f00140cde0be7548d

## Done when

1. **Executable** — `npx vitest run` over `we:scripts/readiness/__tests__/dispatch-plan.test.mjs` and `we:scripts/conveyor/__tests__/tick-core.test.mjs` fails on the plan/hint cases before this item lands (no `activeCount`/`room` on the plan) and passes after; the clamp-table and withheld-lane rows are characterization tests proven by hand mutation (see Test plan).

## Progress

- Premise check (2026-09-30, `main` @ 3448e52f4): goal NOT delivered (`git log --grep=4436` only shows the JIT-number drain commit). The card's `file:line` cites have drifted; corrected below. Scope unchanged (all three files still the right ones).
  - #1 `we:scripts/readiness/dispatch-plan.mjs:1039` → now the CLI print at `:1152`, which calls `capacityCapHint(leases.length, maxConcurrentLanes)`: it counts only PRE-EXISTING leases, so a tick with launches plus `capacity-cap` holds prints a stale, too-large room.
  - #2 `we:scripts/conveyor/__tests__/tick-core.test.mjs:1704` → now the #4347 summary-note test at `:1899-1925`, which only asserts `capNotes[0].lanes` `toHaveLength(14)`.
  - #3 `we:scripts/readiness/__tests__/dispatch-plan.test.mjs:914` → now `describe('capacityCapHint (#4347)…')` at `:1060-1071`, which covers only (2,8), (8,8), (10,8).
  - #4 `we:scripts/readiness/dispatch-plan.mjs:245` → now `capacityCapHint` clamp at `:259-260`.

## Design

`dispatchPlan` (`we:scripts/readiness/dispatch-plan.mjs:440-654`) already computes the active-lease count (`activeLeases.length`, `:449`) and the admitted launches, but returns only `{ launch, held, admission? }` (`:654`). The CLI print (`:1152`) then recomputes from `leases.length` and ignores this tick's launches, so it can disagree with what the core used.

1. Add `activeCount` (= `activeLeases.length + launch.length`, the load after this tick's launches) and `room` to the returned plan object. Keep them ADDITIVE: `held` items stay `{ num, reason }` (queue-report's exact-string classifier depends on it, per the `capacityCapHint` docblock at `:247-254`). Compute `room` with the clamp that already exists in `capToConcurrency` (`we:scripts/lib/lane-concurrency.mjs:69`, `max(0, floor(cap) - max(0, floor(active)||0))`): extract it as a small exported helper there and have both `dispatchPlan` and `capacityCapHint` (`:259-260`, which duplicates it) call it, so they cannot diverge. **Infinite cap:** `maxConcurrentLanes` defaults to `Infinity` (`:435`), which `JSON.stringify` turns into `null`; rule: when the cap is not finite, OMIT `room` (keep `activeCount`), and pin that in a test.
2. Make the print at `:1152` pass `plan.activeCount` instead of `leases.length`, and change the hint wording to "N active (incl. launching this tick)" so the count is not misread as already-leased lanes (the #4347 misread). `capacityCapHint` keeps its signature. To make the print testable (`main()` is unexported and calls `process.exit`), extract the per-hold hint builder into a pure exported function and test that.
3. Tests: update the two empty-input assertions at `we:scripts/readiness/__tests__/dispatch-plan.test.mjs:899-900` (`toEqual({ launch: [], held: [] })` would fail on the new keys) to include `activeCount: 0` and no `room` (default cap is infinite). Whole-plan `toEqual`s at `:1087`/`:1262` compare plan to plan and are unaffected. Then tighten the tick-core note test and the clamp table as below.

## MVP

Musts (guards 1–3 of the card):
- Plan returns `{ activeCount, room }` (`room` omitted for an infinite cap); CLI print uses them via a pure hint builder; shared clamp helper; test: plan with launches plus holds reports `room: 0`; existing empty-plan assertions updated.
- tick-core summary-note test asserts the exact withheld lane-id array (free lanes 10..29, 6 admitted → expect the remaining 14 ids in rank order; verify actual order when writing, do not guess).
- Table-driven exact-string `capacityCapHint` cases: negative/`undefined`/`NaN`/fractional active count, over-cap (`(10,8)` converted from `toContain` to exact string), and bad caps (`NaN`, `undefined`, fractional): clamp the cap in the shared helper so the text never prints `room NaN`, and pin the output. These pin every branch (`Math.max(0, floor||0)` and the room floor).

Explicitly OUT (→ Follow-ups): guard 4, a mutation-testing gate. It needs a new tool/CI dependency and a policy call on its scope; guard 3's table-driven cases already make the named mutation (dropping `Math.max(0, …)`) fail a test, which is the protection guard 4 asks for, in a unit suite that already runs.

## Test plan

- In `we:scripts/readiness/__tests__/dispatch-plan.test.mjs`, "plan reports activeCount/room after launches": 1 lease, cap 2, 3 disjoint items, 3 free lanes → `plan.activeCount === 2`, `plan.room === 0`, holds `capacity-cap`. RED before: both keys `undefined`.
- Same file, "room floors at 0 when cap < active": leases 3, cap 2 → `room === 0`, never negative. RED before: undefined.
- Same file, "infinite cap": default-cap plan has `activeCount` and no `room` key, and `JSON.stringify` output has no `null` room. RED before: `activeCount` undefined.
- Same file, `it.each` for `capacityCapHint`: `(-3,8)`→`0 active, room 8 of cap 8…`; `(undefined,8)`→same; `(NaN,8)`→same; `(2.7,8)`→`2 active, room 6 of cap 8…`; `(10,8)`→exact `room 0`; bad/fractional cap rows with output pinned at write time. **These are characterization tests** (the clamp already exists, so they pass before the change, except the bad-cap rows and the reworded hint text); their proof is a hand mutation: delete `Math.max(0, …)` on the `active` line and on the `room` line and confirm a row fails for each.
- In `we:scripts/conveyor/__tests__/tick-core.test.mjs`, `:1924`: replace `toHaveLength(14)` with `toEqual([…14 ids…])` (expected 16..29). Also a characterization test; proven by locally swapping `admitted`/`overflow` ordering and seeing it fail where the length-only check would not.
- Hint builder: a unit test on the extracted pure function feeding a plan with launches + `capacity-cap` hold and asserting the text uses `plan.activeCount` ("room 0"). RED before: the function does not exist / prints `leases.length`.

## Proof plan

Fixture run, not the live queue (which may not produce the shape): drive `we:scripts/readiness/dispatch-plan.mjs` with `WE_MAX_CONCURRENT_LANES=2`, one lease, three disjoint queued items and three free lanes (via the script's fixture/`freeLanesOverride` inputs). Before on `origin/main`: the printed `capacity-cap` hold reads a positive room from `leases.length`. After in the lane: `--json` carries `activeCount: 2, room: 0` and the printed hold reads "2 active (incl. launching this tick), room 0 of cap 2". Capture both outputs, and the output of the hand mutation runs above, in the PR body.

## Follow-ups

- Mutation-testing gate for the readiness/conveyor scripts (guard 4 of this card): tool choice (Stryker vs. a lightweight hand-rolled mutant list), scope, CI cost. Nameable as its own backlog item.
- Audit other CLI print paths that recompute a value the core already computed (same class as guard 1).
