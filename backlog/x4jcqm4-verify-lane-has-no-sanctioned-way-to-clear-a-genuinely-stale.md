---
kind: story
size: 2
parent: "3321"
status: open
dateOpened: "2026-08-27"
tags: []
---

# verify-lane has no sanctioned way to clear a genuinely-stale terminal marker

`we:scripts/verify-lane.mjs` refuses to start a new run when `.git/.lane-verify` holds a terminal
(`green`/`red`) record for a **different** sha, to protect a sibling run's result (#2833 finding
4). Correct when two runs truly overlap. But when the prior run is simply finished and stale — the
marker's own `finishedAt` is hours old, no process holds the lane's lease — there is still no
command to clear it: the only way past the refusal is to `rm` the marker file by hand. Hit this
twice tonight in two different reused lanes (lane-1, lane-2), each blocking a small doc-only change
until manually cleared. Add a `--reset` mode (or equivalent) that checks the lane has no active
lease before deleting the marker, so recovery is scripted instead of ad hoc.

## Done when

1. **Executable** — a test spawns `we:scripts/verify-lane.mjs` against a fixture repo with a stale
   terminal marker for a foreign sha and an unleased lane, runs the new reset path, and asserts the
   marker is gone and a subsequent `verify` run starts cleanly.
2. **Executable** — a test asserts the reset path refuses when the lane's lease file shows an
   active, unexpired holder, so it cannot be used to clobber a genuinely concurrent run.
