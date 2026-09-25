---
bornAs: x96v5hl
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
graduatedTo: "we:scripts/lane-pool.mjs"
tags: []
---

# Lease release/reap races: check-then-act without re-verifying same lease, and a half-written lease reads as expired

we:scripts/lane-pool.mjs's cmdRelease and reapDeadLeasesInPool both read a lease, decide it's reapable/releasable, then rmSync it much later with no re-check that it's still the same lease — a check-then-act race, unlike we:scripts/lane-pool.mjs's cmdTrim, which already uses its own sameLease comparator for exactly this TOCTOU. Also: expired-lease reclaim in tryClaimLane lets two concurrent acquirers both pass the staleness check and both write a fresh lease, and lease writes are plain writeFileSync (not atomic), so a writer crashing mid-write can leave a partial file a reader parses as malformed/expired rather than atomically absent-or-complete. Fix: re-read and sameLease-compare the lease immediately before every reap/release rmSync; write leases via a temp-file-then-rename so a reader never observes a partial write.

## Done when

1. **Executable** — `npx vitest run --config we:vitest.integration.config.ts we:scripts/__tests__/lane-pool-release-reap-race.test.mjs`
   and `we:scripts/__tests__/lane-pool-stale-reclaim-race.test.mjs`: a real `release --force` / stale-lease
   `acquire` is paused mid-run (env-var test seam, mirroring `cmdTrim`'s own barrier) while a real concurrent
   second CLI child lands on the exact same lane; both fail before this fix (the paused call's unconditional
   `rmSync` clobbers the concurrent winner's fresh lease) and pass after (the `sameLease`/`takeMarkerIf` guard
   detects the change and backs off).
