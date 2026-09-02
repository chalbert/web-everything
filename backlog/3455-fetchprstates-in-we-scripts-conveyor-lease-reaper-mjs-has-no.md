---
bornAs: xhxezum
kind: task
status: open
dateOpened: "2026-09-02"
tags: []
---

# fetchPrStates in we:scripts/conveyor/lease-reaper.mjs has no gh timeout - a hung/unauthenticated gh can block the periodic reaper indefinitely

we:scripts/conveyor/lease-reaper.mjs's fetchPrStates() (line ~258) calls execFileSync('gh', ['pr','list',...]) with no timeout option at all — unlike the two sibling gh/git bounds in we:scripts/lane-pool.mjs's acquire-native reap path (reapDeadLeasesInPool / liveRemoteShas), which are explicitly bounded (widened to 20s in #3411) so a slow/hung/unauthenticated gh can never stall a dispatch. fetchPrStates is only reached by the standalone periodic lease-reaper CLI, not by we:scripts/lane-pool.mjs acquire, so it's a separate code path and out of #3411's scope — but it's the same class of bug sitting right next to the code #3411 fixed. Add a timeout (e.g. 20_000ms matching the sibling bounds) so a hung gh degrades the PR axis to OFF instead of hanging the periodic reaper run indefinitely.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
