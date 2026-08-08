---
kind: task
status: open
dateOpened: "2026-08-08"
tags: [testing, gate]
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

## Done when

- The spawn-count fixture makes HEAD a strict ancestor of a live remote head, so the
  containment loop is actually entered.
- The assertion FAILS when run against the pre-#2920 implementation and passes against the
  current one. Record both measurements in the test's own comment so the next reader does
  not have to re-derive that it works.
