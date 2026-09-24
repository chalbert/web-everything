---
kind: story
size: 5
status: resolved
scaffoldedBy: "lane-pool-list-perf"
dateScaffolded: "2026-09-23"
scope: ["we:scripts/lane-pool.mjs", "we:scripts/lib/lane-lease.mjs", "we:scripts/lib/__tests__/lane-lease.test.mjs", "we:scripts/__tests__/lane-pool-list-cache.test.mjs", "we:vitest.config.ts", "we:vitest.integration.config.ts"]
dateOpened: "2026-09-23"
dateResolved: "2026-09-23"
graduatedTo: none
tags: []
---

# lane-pool list --acquirable: lease-first skip, read-only git, single-flight cache

Observed live 2026-09-23: fseventsd pinned at ~100% CPU / ~25% RAM. Root cause: 14 concurrent `node we:scripts/lane-pool.mjs list --acquirable --json` (plus a couple of `status --json`) processes, some running 10-71 minutes, each spawning git in every one of ~129 lanes under ~/workspace/.lanes/web-everything; they pile up and slow each other down. Hot path: `cmdList` -> per-lane `laneAcquirableInfo` -> `laneDirtyOrAhead` runs `git status --porcelain` + `git rev-list --count` BEFORE the cheap lease check; `git status` stats the whole tree and opportunistically rewrites .git/index (more FS events); `reapDeadLeasesInPool` (incl. a gh pr list) also runs on every `list --acquirable`. Plan: (1) lease-first short-circuit — read the lease marker first and skip git for any lane whose LIVE lease already disqualifies it (exact `isLaneAcquirable` semantics, we:scripts/lib/lane-lease.mjs), also applied to acquire auto-pick and provision --acquirable; (2) GIT_OPTIONAL_LOCKS=0 on read-only git calls (status/rev-list/rev-parse/for-each-ref/ls-remote/cherry/...) so they never rewrite the index, never on mutating ones (fetch/reset/clean/checkout); (3) single-flight + short cache for `list --acquirable` — the first caller takes an atomic mkdir lock under the pool dir, scans, writes a timestamped result; concurrent/subsequent callers within the TTL (default 30s, flag/env) reuse it, waiters poll with a bounded wait, a stale lock (dead holder pid or older than the scan timeout) is taken over, `--no-cache` forces a fresh scan; a stale cached 'acquirable' answer is safe only because `acquire` re-derives and atomically claims (`tryClaimLane` O_EXCL + #2924/#3390 re-verify); (4) `--limit=N` early stop (never writes a truncated cache); (5) overall scan timeout (default 120s) that fails cleanly.

## Done when

1. **Executable** — `npx vitest run --config we:vitest.integration.config.ts we:scripts/__tests__/lane-pool-list-cache.test.mjs` passes (lease-first skip runs no git in a live-leased lane; read-only git carries GIT_OPTIONAL_LOCKS=0 and mutating git does not; cache hit inside TTL, miss after TTL, lease-change invalidation, `--no-cache`; concurrent callers share one scan; stale-lock takeover for a dead pid and an over-age holder; `--limit` early stop with no truncated cache; clean scan-timeout failure). Fails before this item: the cache/lock/limit/timeout flags did not exist (rejected as unknown flags).
2. `npx vitest run we:scripts/lib/__tests__/lane-lease.test.mjs` — `leaseDisqualifiesAcquire` implies `isLaneAcquirable` is false for every `dirtyOrAhead` shape (the proof that the skip is verdict-preserving).

## Delivered

- Lease-first in `laneAcquirableInfo` (list/provision) and `cmdAcquire`'s `infoFor` auto-pick via the pure `leaseDisqualifiesAcquire` (we:scripts/lib/lane-lease.mjs).
- `GIT_OPTIONAL_LOCKS=0` on a subcommand allowlist of read-only git calls in the `git`/`tryGit` wrapper.
- `list --acquirable` single-flight (atomic mkdir lock under the pool dir) + result cache (`--cache-ttl-ms` / `LANE_POOL_LIST_CACHE_TTL_MS`, default 30s, 0 disables; lease-marker fingerprint invalidation; provision/refresh invalidate), `--no-cache`, `--limit=N`, `--scan-timeout-ms` / `LANE_POOL_LIST_SCAN_TIMEOUT_MS` (default 120s).
- The `git cherry` per-remote-head fan-out (the coordinator's follow-up) landed separately on main as #xjyn3fg while this was in flight; this item keeps that fix unchanged and does not touch it.
- Live measurement on the real 118-lane pool (with 9 old-code scans still running): fresh scan 43s, cached re-call under 1s.

