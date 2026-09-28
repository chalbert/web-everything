---
kind: story
size: 1
priority: medium
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "c7e4fd628fd6ee4436b82103f7d1ce35ca7fd8a7"
tags: []
---

# capacity-cap note says "concurrent-lane cap (8) reached" when only 2 lanes are active

With 2 lanes active and a cap of 8, tick-core has room for 6. It assigns 6 free lanes and then writes one note
per remaining free lane: "⏸ lane-N available but withheld — concurrent-lane cap (8) reached". That was 68 notes
on 2026-09-28. The text reads as "8 lanes are busy". It led the 08:30 ET investigation to hunt for 8 phantom
active lanes, when the real holds were load-cap (card x45rs01) and the build daemon's own cap (card x0jgunh). This
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
