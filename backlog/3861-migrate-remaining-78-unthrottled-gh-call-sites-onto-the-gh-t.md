---
bornAs: xbxmu75
kind: story
size: 8
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/pr-watch.mjs", "we:scripts/wait-green.mjs", "we:scripts/lib/pr-merge-gate.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-21"
blockedBy: ["3670"]
tags: [gh-throttle, rate-limit]
---

# Migrate remaining ~78 unthrottled gh call sites onto the gh-throttle wrapper

we:scripts/lib/gh-throttle.mjs now carries a per-minute points budget and call/exhausted-retry recording (#3670 slice 1). This item is the remaining slice #3670 itself named: migrate the rest of the roughly 84 gh-calling sites onto the wrapper, highest-risk first: we:scripts/conveyor/tick-core.mjs (around line 1379, fires every tick), we:scripts/conveyor/pr-watch.mjs (around line 398, polls every 20 seconds), we:scripts/wait-green.mjs (around line 106, polls every 15 seconds), we:scripts/lib/pr-merge-gate.mjs, we:scripts/operations/dispatch-lane-io.mjs -- then we:scripts/merge-ai-prs.mjs, added to scope by the #3699 ruling (about 25 unthrottled gh call sites, confirmed live at about 20 execFileSync(gh, ...) sites plus its execFile-shaped calls) -- then the rest of the original grep. Each site migrates to we:scripts/lib/gh-throttle.mjs's runGhSync/execFileSyncThrottled or the CLI passthrough, with a side-by-side output comparison against raw gh proving byte-for-byte fidelity, the same proof #3631's landed slice and #3670 slice 1 used.

## Done when

1. **Observable** — copied from #3670's own Done-when: a grep for raw `gh` spawns outside the wrapper, over the files in this item's scope, returns none.
2. **Executable** — each migrated site's output is proven byte-for-byte identical to the raw `gh` call it replaces (the same side-by-side fidelity proof we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs already uses for #3621's landed slice), so a caller cannot tell the difference.
