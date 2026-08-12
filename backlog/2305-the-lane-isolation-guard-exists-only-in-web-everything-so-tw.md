---
bornAs: xirbbbl
kind: story
size: 2
status: open
dateOpened: "2026-08-12"
relatedTo: ["2123"]
tags: [gate, guard, lane, constellation, footgun]
scope:
  - we:scripts/guard-lane.mjs
---

# The lane-isolation guard exists only in web-everything, so two primaries are wholly unguarded

`#3074` fixed the guard's workspace-root derivation, and its card claimed a primary edit is now denied
"whatever directory the hook is launched from". That is true of the pure function and **false in production**:
the hook is registered only in web-everything, and the script exists only there. Started anywhere else — a
plateau lane, the frontierui checkout, `/tmp` — nothing runs at all.

## Verified

```
frontierui/scripts/guard-lane.mjs   → No such file
frontierui/.claude/settings.json    → no guard-lane hook
plateau-app/scripts/guard-lane.mjs  → No such file
plateau-app/.claude/settings.json   → no guard-lane hook
```

The hook is a **relative** invocation registered in
[we:.claude/settings.json](../.claude/settings.json) — so it resolves against the caller's directory, and only
a directory carrying both the setting and the script produces a guard at all. From frontierui, plateau-app, or
any of their lanes, an edit to any primary checkout proceeds unchecked.

This is larger than the bug `#3074` fixed. That one left the primaries open **from a WE lane**; this leaves
them open from two whole repos, and it was never closed rather than having regressed.

## Why the earlier card overstated it

The fix was verified against `laneGuardDecision` — the pure decider — from three simulated launch roots
including a plateau lane. That proves the *decision* is right wherever it is asked. It does not prove anyone
asks. The reviewer of `#3074` drew that distinction and it is the correct one: **a pure function's coverage
is not a hook's coverage.**

## Two smaller gaps found alongside, recorded so they are not rediscovered

- **A lane directory that is itself a symlink resolving outside `.lanes/`** reopens the original hole — Node
  realpaths its main module, the `.lanes` segment is lost, and the `dirname` fallback picks the wrong
  primaries. Not reachable today: [we:scripts/lane-pool.mjs](../scripts/lane-pool.mjs) clones real directories
  and no symlinked lanes exist.
- **Deployment lag.** The copy that runs is the lane's own, so a leased lane keeps the old guard until it is
  re-acquired. Any fix to a hook is live only for lanes refreshed after it lands.

## What a fix has to decide

The guard cannot simply be copied into two repos — that is three copies to keep in step, and the failure mode
is silent divergence. Worth weighing an absolute path, a shared install step, or moving the hook to the
user-level settings so it is registered once regardless of cwd. Each trades portability against a single point
of truth, and that trade should be made deliberately.

## Done when

- [ ] An edit to any constellation primary is denied from any of the three repos and their lanes.
- [ ] There is one source of the rule, not three copies that can diverge.
- [ ] The symlinked-lane case is either closed or recorded as accepted with its reachability stated.
