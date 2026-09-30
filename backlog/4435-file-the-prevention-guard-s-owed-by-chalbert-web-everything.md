---
bornAs: xo8zrer
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "7c08e4c13933bc6bb85eb8d2853f896470d00ed3"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2839's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:157` — Add a deterministic daemon regression test with a positive buildingInFlight value distinct from building, asserting the remaining capacity exactly.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2839@b6d7c1e507538bd3c6828db460f1ba06b63a60cf

## Design

**Premise check (against `main` @ 7c08e4c13).** The guard is still owed, but its wording is stale. The card asks for a test
"asserting the remaining capacity exactly" for a positive `buildingInFlight`. Since card x3vs6tu (2026-09-29) the cap no
longer subtracts it: `planBuildDispatch` sets `busy = running.length` only (`we:scripts/conveyor/build-dispatch-policy.mjs:230-231`),
and `externalBuilding` is returned purely as a logged signal (`:314`). So the only thing a positive `buildingInFlight`
can still change is `plan.externalBuilding`, and the only daemon-level thing worth pinning is the wiring that feeds it:
`externalBuilding = Number(d.counts?.buildingInFlight ?? d.counts?.building) || 0`
(`we:skills-src/conveyor/build-dispatch-daemon.mjs:396`, passed at `:404`, re-surfaced at `:630`).

**Gap.** Every existing daemon test feeds `buildingInFlight: 0` (`we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:225`, `:813`, `:929`) or omits
it (`:238`). The policy test pins `externalBuilding: 2` only at the pure-planner level (`we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs:57-61`),
never through `runBuildDispatchTick`. So nothing fails if line 396 is flipped to prefer `building`, or if the value stops
reaching `planBuildDispatch`, or if a later change folds it back into the cap.

**Fix.** Add one test beside `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:220-231`, using the existing `manySpawnsTick` /
`noInFlightEffects` helpers, with `counts: { building: 6, buildingInFlight: 2 }` (positive and distinct), cap 3, 6 spawns,
`live: false`. Assert: `plan.externalBuilding === 2` (reads `buildingInFlight`, not `building`), and
`plan.busy === 0` and `plan.dispatch.length === 3` (the cap is still the full 3, so `buildingInFlight` is not subtracted). Add a
second case with one own durable in-flight run-store row (`listRunStoreInFlight`) plus the same counts, asserting
`plan.dispatch.length === 2`, `plan.busy === 1`, `plan.externalBuilding === 2`
(remaining capacity is exactly cap minus the builder's OWN in-flight, never the external count). Also fix the stale
comment at `:220`/`:227` ("reads buildingInFlight … for the cap") only if the new test's comment makes it contradictory.

## MVP

Musts only: the two assertions above in `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` (the card's declared scope). No production code
change.

Out of scope (see Follow-ups): renaming the stale x0jgunh test title, an operator-facing display of `externalBuilding`.

## Test plan

- **`a positive buildingInFlight distinct from building is reported as externalBuilding and never reduces the cap`** —
  asserts `plan.externalBuilding === 2`, `plan.busy === 0` and `plan.dispatch.length === 3`. RED if `:396` prefers `building`
  (externalBuilding 6), if the value is dropped before `planBuildDispatch` (externalBuilding 0), or if it is folded back into
  `busy` (busy 2). Note: `busy` feeds only the return value; dispatch capacity comes from `slotsByClass`
  (`we:scripts/conveyor/build-dispatch-policy.mjs:233-235`), so a fold into `busy` alone is caught by the `plan.busy` assertion,
  not by the dispatch count.
- **`remaining capacity is cap minus this builder's own durable in-flight builds, not minus buildingInFlight`** — one own
  in-flight row (override `listRunStoreInFlight` with `{num:'900', scope:['plateau-app:src/own.ts'], source:'run'}`; num must not
  collide with spawn nums 200-205) + `buildingInFlight: 2`, cap 3 → `plan.dispatch.length === 2`, `plan.busy === 1`,
  `plan.externalBuilding === 2`. RED if capacity is ever derived from the external count (dispatch would drop), if `busy` folds
  the external count (busy 2), or if the `:396` wiring regresses (externalBuilding ≠ 2).

Each is verified RED by temporarily applying the mutation in the lane (swap to `counts.building ?? counts.buildingInFlight`;
then re-add `Math.max(running.length, externalBuilding)` to `busy`) and reverting.

## Proof plan

Run `npx vitest run build-dispatch-daemon -t "buildingInFlight"` three ways and record
the output in the PR body: green on `main`'s production code; red with the `:396` swap; red with the fold-back mutation.
No live surface: this is a regression guard over pure daemon wiring, so the mutation-RED evidence is the before/after.

## Follow-ups

- Rename/re-comment the x0jgunh test at `:220` so its title no longer says the count is read "for the cap".
- Surface `plan.externalBuilding` in the `--dry-run` report line so operators can see the logged signal.

## Done when

1. **Executable** — `npx vitest run build-dispatch-daemon -t "buildingInFlight"`
   passes with the new cases and fails when `we:skills-src/conveyor/build-dispatch-daemon.mjs:396` prefers `counts.building` or when
   `we:scripts/conveyor/build-dispatch-policy.mjs` folds `externalBuilding` into `busy` (caught via `plan.busy`).
