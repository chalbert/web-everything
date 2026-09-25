---
bornAs: xdtot9p
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
graduatedTo: none
tags: []
---

# Lane-pool health watch publishes a free-lane list; acquire consumes it instead of scanning

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md, finding P1 (batch the health watch's own git cost
plus change detection). Original shape proposed here: lease-first skip in `we:scripts/lane-pool.mjs`'s
`laneStatus`, one pool snapshot shared by the watch's four consumers, log a lane line only when its verdict
changed.

**Superseded by a live incident, 2026-09-25, before that shape was built.** Review sessions started giving up
because `we:scripts/lane-pool.mjs acquire`'s auto-pick can't find a lane within its 180s wait: the shared,
single-flight full-pool scan it sources candidates from (#4012/#3383) is cheap when idle (35.8s measured,
88 lanes, 27 acquirable) but degrades hard under concurrent load — live-measured 240s for `acquire`, 66s for
`list --acquirable`, against acquire's 180s ceiling, while 30+ lanes sat genuinely free. Victims: PR #2647 (4
failed reviews), #2625 (8), #2596 (5); 41 sessions ended `blocked-on-infra`. Operator-approved fix (the
FREE-LANE LIST): this health watch already walks the whole pool every tick for its own litter-reap/trim/reclaim
passes, and already shells the exact `list --acquirable` scan `acquire` wants — so it publishes that tick's
answer once (`we:scripts/lib/free-lane-list.mjs`, atomic write, one file per pool, under `CONVEYOR_STATE_ROOT`
when pinned else next to the pool), and `acquire`'s auto-pick reads it as a fast pre-filter FIRST, falling back
to today's scan only when the list is missing, stale (>10min default) or exhausted. The list is NEVER trusted
alone: every candidate is still claimed atomically (`tryClaimLane`'s O_EXCL) and re-verified fresh
(`provisionClaimedLane`'s existing #2924 check) before it's ever handed out — a stale/wrong entry costs at most
a lost race, proved live (see Delivered) when the real list named lane-11 (a known-bad lane, separate origin
misconfiguration — see Delivered) and acquire safely skipped it in the same sub-5s call.

An earlier draft also tried to make the SCAN FALLBACK itself stop at the first provably free lane
(`limit: 1`) with a tighter per-lane git timeout. Reverted pre-land: `scanAcquirable`'s `limit` early-stop is
not exclusion-aware, so it always names the same lowest-index candidate on retry — once that candidate is
excluded (a lost claim race, a vanished lane, a failed #2924 re-verify) the picking loop could never reach a
second one from the same scan snapshot, which `we:scripts/__tests__/lane-pool-acquire-vanished-lane.test.mjs`
and `we:scripts/__tests__/lane-pool-acquire-refused-lease.test.mjs` caught red before this landed. Left as a
fast-follow (needs `scanAcquirable` to accept an exclusion set) rather than risk it in the fix this incident
was blocked on. The original "lease-first skip in laneStatus" batching is *also* left as a fast-follow: the
free-lane list already removes the scan from `acquire`'s hot path entirely on the common path, which was most
of this card's original cost concern; `laneStatus`'s own per-tick git cost (used by `status`/the health
watch's own snapshot) is unchanged and still open for a future pass.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/free-lane-list.test.mjs` (pure parse/freshness/
   build/candidate-ordering + atomic read/write IO shell; red without `we:scripts/lib/free-lane-list.mjs`,
   green with it) and `npx vitest run we:scripts/conveyor/__tests__/lane-pool-health-watch-free-list.test.mjs`
   (the health watch publishes from the REAL eligibility read, never the plan-only guess; publishes even on
   `--dry-run`; degrades to `null` on a write failure or an unavailable real read) both pass; fail (import
   error / missing export) before this item.
2. `npx vitest run --config we:vitest.integration.config.ts we:scripts/__tests__/lane-pool-acquire-free-list.test.mjs`
   — real spawned `we:lane-pool.mjs` CLI against a throwaway origin/pool: a fresh list naming a free lane is used
   with far fewer lane git calls than a full scan; a STALE list (and one naming a nonexistent lane) is never
   consulted, falling back to the scan; a lane the list named that went BUSY between publish and acquire is
   skipped and never double-claimed; a MISSING list is a pure no-op; `--no-free-list` opts out. Fails
   (unrecognized flag / old behavior) before this item.
3. The full pre-existing `we:scripts/__tests__/lane-pool-*.test.mjs` suite (both `we:vitest.config.ts` and
   `we:vitest.integration.config.ts` tiers) stays green — no regression to the existing scan/cache/reclaim/reap
   paths this shares code with.

## Delivered

- `we:scripts/lib/free-lane-list.mjs` (new): pure parse/build/freshness/candidate-ordering core + atomic
  write/tolerant read IO shell, path resolution honoring `CONVEYOR_STATE_ROOT` (#4052) else next to the pool.
- `we:scripts/conveyor/lane-pool-health-watch.mjs`: publishes the list every tick from the SAME real
  `list --acquirable` read `summarizeHealth` already cross-checks against (never the plan-only estimate — a
  live-caught 14-vs-3 false-positive gap #3383 already found for this exact file); publishes on `--dry-run` too
  (a bookkeeping sidecar, not a pool-lane mutation, matching `we:.list-acquirable-cache.json`'s own convention).
- `we:scripts/lane-pool.mjs` `acquire` auto-pick: reads the list first (`--no-free-list` / `--free-list-max-age-ms`
  override), tries each named lane in order via the EXISTING claim-then-provision picking loop unchanged (no new
  claim/re-verify path — the free list only changes where the CANDIDATE comes from), falls back to today's
  scan once exhausted.
- **LIVE, real WE pool (88 lanes), 2026-09-25**: one real health-watch sweep (`--dry-run`, read-only apart from
  the list) published `we:.free-lanes.json` (36 candidates) in ~176s (its own `status`+trim+whois cost, unchanged
  by this item). Before/after `acquire`, 8 concurrent `--purpose=test --wait-ms=180000` callers (released
  immediately, no lanes left held):
  - **Before** (today's scan-only path, cache cleared to force a cold scan): 66.7s, 107.6s, 150.9s, 181.7s,
    181.9s, 182.0s, 182.1s, 182.2s — 5 of 8 essentially hit the 180s ceiling; at the operator's real wait these
    would have failed exactly like the incident.
  - **After** (free list fresh, from the sweep above): 3.3s, 3.3s, 3.6s, 3.7s, 3.7s, 3.8s, 3.9s, 5.8s — all 8
    succeeded on distinct lanes, no double-claim. A single `acquire --purpose=test`: 4.9s, including lane-11 (a
    known-bad lane — its `origin` remote is a stale local path instead of GitHub, live-caught 2026-09-25,
    unrelated pre-existing provisioning issue, not touched here) being claimed, failing its #2924 re-verify
    (`324 ahead, provably-pushed=false`), released, and the fast path safely falling through to lane-21 from
    the same list — proving the "never trusted alone" design on a real, live false-positive.
