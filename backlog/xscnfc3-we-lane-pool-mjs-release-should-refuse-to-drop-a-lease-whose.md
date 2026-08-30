---
kind: task
status: open
dateOpened: "2026-08-30"
tags: []
---

# we:lane-pool.mjs release should refuse to drop a lease whose lane is ahead of origin

PR #1720 review finding: we:scripts/lane-pool.mjs release (cmdRelease, ~line 1288) drops a lease unconditionally once ownership/reserved checks pass -- it never checks whether the lane HEAD carries local commits not yet on origin/<branch> (what laneDirtyOrAhead already computes elsewhere in the same file as ahead, but release never calls it). A caller that releases based on a stale or incomplete signal (e.g. we:skills-src/closing-session/SKILL.md before this same PR fixed its own recipe) can drop a lease while local-only commits still sit on the lane, and the next refresh/reuse of that lane fast-forwards it, silently discarding them.

## Done when

1. **Executable** — a test asserting that `release --lane=<N>` (no `--force`) on a lane whose HEAD is
   ahead of `origin/<branch>` (a real committed-but-unpushed-or-unmerged commit) refuses and leaves the
   lease intact, mirroring the existing reserved/contested-lease refusal pattern in the same file. `release
   --lane=<N> --force` still overrides, same as it does for a contested lease today. Fails before this item
   lands (release currently drops the lease unconditionally), passes after.
