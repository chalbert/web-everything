---
kind: task
status: open
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/lane-pool.mjs", "we:scripts/lib/git-patch-equivalence.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Extract the shared we:git-cherry patch-equivalence primitive between we:scripts/conveyor/lease-reaper.mjs and we:scripts/lane-pool.mjs

we:scripts/conveyor/lease-reaper.mjs's defaultGitIsAncestor (added by #xkk4lv7) and we:scripts/lane-pool.mjs's cherryAllPatchEquivalent independently implement the same small git-cherry-output parse ('every line prefixed - means already patch-equivalent') for two different callers (branch-vs-one-merge-commit containment in the former, a lane's ahead commits vs a live remote head in the latter). we:scripts/conveyor/lease-reaper.mjs cannot import we:scripts/lane-pool.mjs (that file already imports FROM we:scripts/conveyor/lease-reaper.mjs, so the reverse would cycle), so today this is a small, deliberately-accepted duplication rather than a shared primitive. Extract the single-target git-cherry patch-equivalence check into a small shared module (e.g. we:scripts/lib/git-patch-equivalence.mjs) both files import, and reduce each call site to a thin wrapper — no behavior change, single-sourcing only.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
