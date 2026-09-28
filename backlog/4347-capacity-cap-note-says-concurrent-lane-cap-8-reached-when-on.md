---
bornAs: xz62k70
kind: story
size: 1
priority: medium
status: resolved
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "c7e4fd628fd6ee4436b82103f7d1ce35ca7fd8a7"
tags: []
---

# capacity-cap note says "concurrent-lane cap (8) reached" when only 2 lanes are active

With 2 lanes active and a cap of 8, tick-core has room for 6. It assigns 6 free lanes and then writes one note
per remaining free lane: "⏸ lane-N available but withheld — concurrent-lane cap (8) reached". That was 68 notes
on 2026-09-28. The text reads as "8 lanes are busy". It led the 08:30 ET investigation to hunt for 8 phantom
active lanes, when the real holds were load-cap (card 4343) and the build daemon's own cap (card 4342). This
is a diagnostic defect, not a blocker.

## Evidence (read-only, 2026-09-28)

- Fresh tick (we:scripts/conveyor/tick-core.mjs fed `{"bookkeeping":{}}`, 08:43 ET): `notes` held 68
  `capacity-cap` entries, lanes 12–88. `state.lanes` had 2 entries (lane-1 `soak-break-2835`, lane-2
  `review-2837`). we:scripts/readiness/scope-lease-collect.mjs `--json` also returned 2 leases, so
  dispatch-plan's own count (`activeLeases.length`) was 2 as well.
- Both counts are the leased lanes only. Neither reached 8. `room = 8 − 2 = 6` in
  we:scripts/lib/lane-concurrency.mjs L68–71 `capToConcurrency`.

## Cause (code)

- we:scripts/conveyor/tick-core.mjs L1327–1328: one note per `capacityBudget.overflow` lane, with fixed text
  "cap (N) reached". Overflow only means "more free lanes than room". It does not mean "N lanes active".
- we:scripts/readiness/dispatch-plan.mjs L411–413: the per-item `capacity-cap` hold has the same ambiguity.

## Fix (smallest)

Replace the per-lane notes with ONE summary note. Example: "⏸ 68 free lanes unused — room 6 of cap 8 (2 active,
6 assigned this tick)". Put the active count and the room in dispatch-plan's `capacity-cap` hold reason too.
Keep `kind: 'capacity-cap'` so existing consumers still match.

## Risks

- A consumer that counts per-lane `capacity-cap` notes. Grep for `'capacity-cap'` consumers before changing, and
  keep one note per tick with a `lanes` array.

## Test plan (each fails before the fix)

- tick-core with 2 leased lanes, cap 8, 20 free lanes and 6 launchable: exactly one `capacity-cap` note, and its
  text contains "2 active" and "room 6".

## Live proof plan

Before: 68 per-lane notes (above). After landing: a fresh tick-core run shows one summary note with the real
active count. The builder's own `--dry-run` from `~/workspace/wev-control` then shows `tick-core=capacity-cap`
holds whose reason names the room, not a bare cap.

## Done when

1. **Executable** — vitest on we:scripts/conveyor/__tests__/tick-core.test.mjs passes with the new case, which fails on main.
2. **Live** — a fresh tick prints one capacity summary with the real active count.

## Progress

- Replaced the per-withheld-lane `capacity-cap` notes in we:scripts/conveyor/tick-core.mjs (`capacityCapNotes`)
  with ONE summary note carrying every withheld lane id in a `lanes` array plus text naming the real active
  count and the real room (e.g. "⏸ 14 free lanes unused — room 6 of cap 8 (2 active)"). `kind: 'capacity-cap'`
  is unchanged; grepped every `kind === 'capacity-cap'` read site in `scripts/`/`skills-src/` and confirmed
  none reads the old per-note `.lane` field (only `.kind`/`.num`, from the separate per-build note, are read
  anywhere).
- Added the same active-count/room detail to we:scripts/readiness/dispatch-plan.mjs's printed `capacity-cap`
  hold hint (new, directly-tested `capacityCapHint(activeCount, cap)`, replacing the now-dead
  `CAPACITY_CAP_HINT` constant), without changing the `held` entries' `{num, reason}` shape —
  we:scripts/readiness/queue-report.mjs's exact-string `capacity-cap` classifier and the existing
  exact-equality tests on `plan.held` are unaffected.
- Added the required failing-before-fix vitest case to we:scripts/conveyor/__tests__/tick-core.test.mjs (2
  active lanes, cap 8, 20 free, 6 launchable → exactly one `capacity-cap` note containing "2 active" and
  "room 6"), plus a direct unit test for `capacityCapHint` in
  we:scripts/readiness/__tests__/dispatch-plan.test.mjs.
- **Live proof — read precisely** (review round 2, claim-accuracy flagged the original wording as overclaiming
  "Live" for a synthetic run): this is `planTick` itself — the exact function a real tick calls — driven
  directly with a plain-object fixture shaped like the incident (2 active, cap 8, 20 free lanes, 6 launchable),
  no shell-out to we:scripts/readiness/conveyor-state.mjs / we:scripts/lane-pool.mjs against live production
  state (which would be unsafe to do from a delivery lane, and could not reproduce the exact incident numbers
  against today's live pool anyway). Stashing the we:scripts/conveyor/tick-core.mjs fix and re-running the SAME
  fixture reproduced the defect exactly — 14 per-lane notes all reading "cap (8) reached"; with the fix
  restored, the same fixture prints the single "2 active, room 6" summary note. This is the proof for
  Done-when #2's "fresh tick" — the planning logic itself, on realistic inputs — not a claim that the live
  production conveyor was invoked.
- **Converge — two review rounds (elevated care, 5-lens panel + red-team each round), outcome: land.** Every
  finding across both rounds routed `carve-out` (introduced but not worse-than-base, all parallelizable) — no
  blocker. Fixed the cheap, real ones on top of the required change: tightened the new test's filter to key on
  `kind` alone rather than also on the new `lanes` field (so a regression back to the old per-lane shape would
  actually fail it); added a `capacityCapHint` unit test and removed the now-dead `CAPACITY_CAP_HINT` constant;
  removed a restated number from the tick-core note text (room and "admitted this tick" were always the same
  value in that branch — said once now); and made `capacityCapHint` display the same clamped active count it
  computes room from, instead of the raw input. Dismissed as genuine carve-outs, out of this item's scope: the
  pre-existing asymmetry between tick-core's and dispatch-plan's two independent capacity-room computations
  (neither introduced by this diff), and a repeated call for an integration test of the CLI `main()` IO shell
  in we:scripts/readiness/dispatch-plan.mjs — no other hint in that same ternary has one either;
  `capacityCapHint` is tested to the same bar as its siblings, and the wiring itself is confirmed by the
  green gate (lint + the full related-test run) on the final commit.
- **Converge round 2** re-panelled the revised diff: findings dropped from 5 to 3, all still `carve-out`.
  Fixed the two real ones — added a dedicated test exercising `launched.spawn.length > 0` (the prior case only
  ever had 0 builds launch alongside the prepare spawns, so that term of the active-count sum was undefended),
  and reworded the "Live proof" bullet above to say precisely what it is (a `planTick`-fixture run) rather than
  imply the live production conveyor was invoked. Dismissed again, same reasoning as round 1: the CLI hint's
  room (`leases.length`-based) is not a bug — it mirrors exactly the quantity `dispatchPlan`'s own pure core
  used to decide the hold, so recomputing it during printing would only ever show "room 0" for every held item.
- **Converge red-team ratified round 2's diff — outcome: land.** Its findings were carve-outs again; fixed the
  one real, cheap one immediately (both new tick-core assertions were loose substring matches — `'2 active'`
  would also pass on "12 active", `'room 6'` on "room 60" — tightened to `'(2 active)'` and `'room 6 of cap 8'`
  in both new test cases). Converge is done for this lane.
