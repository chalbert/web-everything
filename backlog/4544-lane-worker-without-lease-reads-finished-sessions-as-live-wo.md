---
bornAs: xx0x4zv
kind: story
size: 2
tier: pinned
status: open
scope: ["we:scripts/lane-whois.mjs", "we:scripts/conveyor/health-smells/lane-worker-without-lease.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# lane-worker-without-lease reads finished sessions as live workers (47 lanes flagged at once)

The new health smell lane-worker-without-lease (#4370, PR #2989, we:scripts/conveyor/health-smells/lane-worker-without-lease.mjs) opened on 47 WE lanes in one tick at 2026-09-29T21:26Z while no worker was running at all. Example: lane-1 — lease none, last holder released 2026-09-28T15:05Z (session conveyor-delivery-lane-1-fd32fe99), its PRs #2838/#2839 merged — yet we:scripts/lane-whois.mjs reports holder ALIVE (live session found). The whois live-session test counts a finished/idle background session still listed by claude agents (cwd or last holder = the lane) as a live worker. MVP: a worker is live only if its session is actually running (busy/process alive and transcript written recently), never merely listed; a released lease whose holder session has since gone idle is not a worker. Test: fixture with an idle listed session → no smell; busy session → smell. Proof: live health tick shows 0 opens with no workers running; soak break: revert → mass opens again.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
