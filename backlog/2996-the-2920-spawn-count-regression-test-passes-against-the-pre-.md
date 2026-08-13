---
bornAs: x7oktlo
kind: task
status: open
dateOpened: "2026-08-08"
tags: [testing, gate]
scope:
  - we:scripts/__tests__/lane-pool-ahead-provably-pushed-single-spawn.test.mjs
  - we:scripts/lane-pool.mjs
---

# The #2920 spawn-count regression test passes against the pre-fix code too

Its fixture pushes HEAD to a live remote tip, so the containment check short-circuits before the fan-out loop is ever entered. Both the fixed and unfixed versions spawn the same 9 processes and both pass, so the guard cannot detect the fan-out returning.

## Where this came from

Found by the PR #1094 review (#2920 — one git spawn per lane for the ahead-contained check).
The fix itself is sound and the review confirmed the speedup on the live pool
(24.5s → 2.7s, zero verdict flips across 104 comparisons). Only the regression *guard* is
hollow. Split out so #2920 could land.

## The problem

`we:scripts/__tests__/lane-pool-ahead-provably-pushed-single-spawn.test.mjs` asserts the
spawn count for one acquire pass stays under the remote-head count. The reviewer ran that
exact fixture against BOTH the fixed and the pre-fix `we:scripts/lane-pool.mjs`:

| | total spawns | merge-base spawns | assertion |
|---|---|---|---|
| fixed | 9 | 0 | PASS |
| **pre-fix (fanned out)** | **9** | **0** | **PASS** |

The ceiling is not the problem — the fixture is. It pushes HEAD to the lane's own remote
branch, so HEAD *is* a live remote tip and `aheadIsProvablyPushed` short-circuits on the
`remoteShas.has(head)` check before the loop it is meant to be guarding. The old fan-out
never runs, so the test cannot see it come back.

## The fix, already identified

Advance the remote branch one commit past the lane so HEAD becomes a STRICT ANCESTOR of a
live remote head rather than equal to one. The reviewer measured this variant:

- pre-fix: 28 spawns / 22 `merge-base` → **FAILS** (the guard now bites)
- fixed: 7 spawns → passes

Both versions still return the same verdict on that fixture, so it remains a valid parity
case as well as a working regression guard.

## Why it is worth doing

A test that passes against the bug it exists to catch is worse than no test: it reports
coverage that is not there. The two SEMANTICS tests in the same file are genuine and should
stay — this is only about the spawn-count assertion.

## Scope note (prepared #2996)

Claim VERIFIED by hand: swapped `aheadIsProvablyPushed` in a lane clone back to its pre-#2920
per-remote-head `merge-base --is-ancestor` loop (`865a6015^:we:scripts/lane-pool.mjs`) and ran the
named test unmodified — all 3 tests, including the spawn-count assertion, still PASS. Confirmed
why: the pre-fix body has the identical `if (remoteShas.has(head)) return true;` short-circuit
ahead of its loop, so pushing HEAD straight to `refs/heads/lane/landed` (making HEAD itself a live
remote tip) trips that same short-circuit in both versions — the old fan-out is never reached
either way.

`aheadIsProvablyPushed` has no `export` (`we:scripts/lane-pool.mjs` exports nothing — grep
confirms) and is called only from `refreshLane` inside the same file. Every other file that
mentions `we:scripts/lane-pool.mjs` (`we:scripts/backlog.mjs`, `we:scripts/lane-drain.mjs`,
`we:scripts/readiness/dispatch-plan.mjs`, `we:scripts/conveyor/tick-core.mjs`,
`we:scripts/conveyor/lease-reaper.mjs`, `we:scripts/merge-ai-prs.mjs`,
`we:scripts/push-if-green.mjs`, `we:scripts/verify-lane.mjs`, `we:scripts/guard-lane.mjs`,
`we:scripts/converge-daemon-pass.mjs`, and the other `we:scripts/__tests__/` files) invokes it as
a spawned CLI subprocess, never via an ES `import` — so a fix confined to this one internal
function doesn't reach them; considered and rejected.
`we:scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs` already has the exact "advance the
remote branch one commit past the lane" mover pattern the fix should reuse (its "ANCESTOR branch"
test, ~line 93-128) — cited as a pattern reference, not touched, since the fix only changes the
fixture in the OTHER file.

## Done when

- The spawn-count fixture makes HEAD a strict ancestor of a live remote head, so the
  containment loop is actually entered.
- The assertion FAILS when run against the pre-#2920 implementation and passes against the
  current one. Record both measurements in the test's own comment so the next reader does
  not have to re-derive that it works.
