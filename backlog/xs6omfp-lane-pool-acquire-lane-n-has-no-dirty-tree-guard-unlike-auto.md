---
kind: task
status: open
dateOpened: "2026-08-29"
tags: [lane-pool, data-loss]
scope: ["we:scripts/lane-pool.mjs"]
---

# lane-pool acquire --lane=N has no dirty-tree guard, unlike auto-pick and refreshLane

`acquire --lane=N` (the explicit-lane path in `cmdAcquire`, `we:scripts/lane-pool.mjs`) resets and
cleans a lane the moment its lease has gone TTL-stale, with no check on whether the working tree
holds recoverable content — unlike the two sibling reclaim paths in the same file, which both run
`laneDirtyOrAhead` / `aheadIsProvablyPushed` (the #2267 "never-recycle-unpushed-work" guard) before
touching a lane's tree.

## Where

`cmdAcquire`, the `if (flags.lane !== undefined)` branch (`we:scripts/lane-pool.mjs`, around line
992 onward), specifically the reset block around lines 1075–1096:

```js
git(['checkout', '-B', repo.branch, baseRef, '--quiet', '--force'], dir);
git(['clean', '-fd', '--quiet'], dir);
```

That block runs unconditionally once a lease is stale — no `laneDirtyOrAhead` call precedes it on
this path. Compare `chooseFreeLane` (auto-pick) and `refreshLane`, both of which call
`laneDirtyOrAhead` first and skip or protect a dirty/ahead lane before ever resetting it.

The code's own comment at that call site says as much:

> "`acquire` has never gated this reset on tree cleanliness (unlike `refreshLane`'s explicit
> `laneDirtyOrAhead` guard) — it must unconditionally reclaim a lane regardless of stray edits left
> by a prior crashed/interrupted session."

That design choice has no compensating protection. A lease going stale (240 min default TTL) is a
completely ordinary occurrence — a long session, a slow multi-hour task — not evidence the prior
work is abandoned garbage.

## Real incident

A session re-acquired lane-11 (`acquire --lane=11 --purpose=...`) after its own prior lease had
gone TTL-stale, mid-epic, with 4 of 5 built-and-tested files sitting as uncommitted edits plus
untracked files. The acquire silently reset + cleaned the lane, destroying all four. They were
recovered only by mining Claude Code's own session transcripts and file-history backup store after
the fact — a recovery path that will not be available in general.

## Ask

Extend the same dirty-or-ahead check (`laneDirtyOrAhead` / `aheadIsProvablyPushed`, or an
equivalent) to the explicit `--lane=N` acquire path. It doesn't need to block forever — refusing by
default and requiring an explicit `--force` (mirroring how other destructive ops in this same file
already require an explicit override, e.g. the live-lease `--force` refusal a few lines above) would
have caught this.

Open question worth resolving alongside the fix: the auto-pick path's existing guard treats
"provably pushed" as safe to recycle — decide whether the same carve-out should apply here, or
whether a lease going stale should instead just re-arm a fresh TTL and prompt the acquiring session
to reconcile first, without ever touching the tree.

## Done when

1. **Executable** — a test reproducing the incident (stage uncommitted + untracked changes in a
   lane, let its lease go TTL-stale, run `acquire --lane=N` without `--force`) fails before this
   item lands (tree gets wiped) and passes after (acquire refuses, or otherwise preserves the
   content, without `--force`).
