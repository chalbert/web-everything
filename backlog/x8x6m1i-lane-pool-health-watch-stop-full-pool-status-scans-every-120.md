---
kind: story
size: 3
status: open
blockedBy: ["xjyn3fg"]
scope: ["we:scripts/conveyor/lane-pool-health-watch.mjs", "we:skills-src/conveyor/daemon-manifest.mjs", "we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# lane-pool-health-watch: stop full-pool status scans every 120s - leased-only read, single-flight, longer interval

Observed 2026-09-23: the lane-pool-health-watch daemons (we:skills-src/conveyor/daemon-manifest.mjs perRepoEntries, DEFAULT_PASS_INTERVAL_MS 120s) run we:scripts/conveyor/lane-pool-health-watch.mjs, whose defaultListLaneStatus shells a full we:scripts/lane-pool.mjs status --json per pool every pass; on the ~129-lane pool one pass ran ~18 minutes, so passes overlap and add git/fs load on top of the pool's clone churn. Plan: (1) add a cheaper status read (e.g. status --unleased-only / --leased-only, whichever the reap plan actually needs) so the watch never walks every lane's full status; (2) single-flight - skip a pass while the previous one for the same repo is still running (lock file or pid check); (3) lengthen this daemon's interval (e.g. 10-15 min) in the manifest. CONFLICT RISK: a status flag touches we:scripts/lane-pool.mjs, which PR #2547 (card xjyn3fg) is actively editing; start only after it lands.

## Done when

1. **Executable** — `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs` gains cases proving: the watch calls the cheaper status read (not the full `status --json`); a second pass started while the first holds the single-flight lock exits as a no-op; and `we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs` pins the longer interval. Fails on origin/main, passes after.
2. **Observed** — one live health-watch pass on the WE pool finishes in well under its interval (timed), and no two passes for the same repo overlap.
