---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# aheadIsProvablyPushed cannot prove containment when the remote tip object is absent locally

Found while writing the missing ancestor-branch test for PR #1022 (review finding 5). liveRemoteShas reads tips over the NETWORK via ls-remote, but merge-base --is-ancestor <head> <tip> needs that tip OBJECT in the local store. When the remote branch advanced and this clone has not fetched since, git answers 'fatal: Not a valid commit name <sha>' (verified on git 2.50.1 in a throwaway repo, both directions: it fails before a fetch and succeeds after one). tryGit maps that to null, so the lane reads as unproven and stays protected. That is the SAFE direction — a lane is never wrongly recycled, so this is incompleteness rather than a regression — but it means the ancestor branch, which does ~12 of 14 real clears on the live pool, silently does nothing whenever the clone is behind. Both behaviours are now pinned by tests in we:scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs. Fix: fetch the containing refs before proving, or prove via the one-spawn rev-list form which has the same object-locality requirement and so needs the fetch either way.
