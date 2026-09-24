---
bornAs: x8v2xw9
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["3895"]
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/forge-land-provider.mjs", "we:scripts/lib/__tests__/forge-land-provider.test.mjs", "we:scripts/pr-land.mjs", "we:scripts/__tests__/pr-land.test.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs", "we:scripts/operations/host-process-sample.mjs", "we:scripts/operations/__tests__/host-process-sample.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate land path, gh-throttle, lease-reaper and host-process-sample from lane/mechanical-dispatcher to main

Ports we:scripts/lib/gh-throttle.mjs, we:scripts/lib/forge-land-provider.mjs, we:scripts/pr-land.mjs, we:scripts/conveyor/lease-reaper.mjs and we:scripts/operations/host-process-sample.mjs, plus their tests. Graduation slice of epic #3443, split out of #3487 on 2026-09-22. FAITHFUL PORT: no behaviour change; port from snapshot 600acc14f of origin/lane/mechanical-dispatcher and diff-merge every file main has also changed (see the merge notes on this card). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

### S3 — land path + reaper + host-process sampler (size 5)

**Blockers:** #3895 only (`we:scripts/lib/gh-throttle.mjs` imports `we:scripts/operations/telemetry-store.mjs`; `we:scripts/operations/host-process-sample.mjs` imports `we:scripts/operations/command-redact.mjs`; its test imports `we:scripts/operations/telemetry.mjs`). `we:scripts/conveyor/lease-reaper.mjs` imports `we:scripts/conveyor/driver-watchdog.mjs`, already on main (#3851).

**Files (incl. tests):**
- `we:scripts/lib/gh-throttle.mjs`, `we:scripts/lib/__tests__/gh-throttle.test.mjs`
- `we:scripts/lib/forge-land-provider.mjs`, `we:scripts/lib/__tests__/forge-land-provider.test.mjs`
- `we:scripts/pr-land.mjs`, `we:scripts/__tests__/pr-land.test.mjs`
- `we:scripts/conveyor/lease-reaper.mjs`, `we:scripts/conveyor/__tests__/lease-reaper.test.mjs`
- `we:scripts/operations/host-process-sample.mjs`, `we:scripts/operations/__tests__/host-process-sample.test.mjs`

(Moved out by ruling: `we:scripts/operations/open-pr.mjs` + test → #3903; `we:scripts/operations/wake.mjs`, `we:scripts/operations/explore-io.mjs` + tests → #3906; `we:scripts/lane-pool.mjs` dropped — already on main.)

**Branch commits:** `fdb78806d` (gh-throttle self-calibrating backoff; gh-throttle + forge-land-provider + pr-land, all here), `aa5f1bb28` (review:awaiting-advisory in pr-land), `a035ab9ef` (lease-reaper real liveness), `6305d81dc` / `388c4d6e8` / `3d760f3da` / `38f66130f` (host-process sampler; runner wiring half is S4).

**Why the seam is clean:** imports only point runner → these modules, never back; each commit's non-runner half is fully inside this slice. `we:scripts/lib/__tests__/gh-throttle.test.mjs` dynamically imports `admissionLockRoot` from `we:scripts/readiness/heavy-admission.mjs`, already on main. Optional finer split: {gh-throttle, forge-land-provider, pr-land} and {lease-reaper, host-process-sample}, size 3 each.

**Merge notes:**
- `we:scripts/lib/gh-throttle.mjs` — 5 regions vs main `b5fabda25` (#3670 per-minute points budget + `calls.jsonl` log); both sides add features at the same spots — take the union:
  1. module header — keep both docblocks (#3670 points budget, then branch self-calibration).
  2. `runGhSync` locals — declare both sets: `points`, `budgetPerMin`, `pointsWindowMs`, `logPath` (main) and `calibrateHeaders`, `headerCapMs` (branch); one `opLabel`.
  3. `runGhSync` failure branch — `if (!isRateLimitShaped(text)) throw failure;` → `headers = parseGhDebugResponseHeaders(failure.stderr)` → `if (attempt >= maxAttempts) { recordGhCallLogEntry(logPath, { op: opLabel, attempt, points, outcome: 'retry_exhausted' }); recordGhThrottleMetric('gh.throttle.rate_limited', ...exhausted); recordGhThrottleMetric('gh.throttle.exhausted', ...); throw failure; }` → branch's `calibratedBackoffMs` + metrics.
  4. spawn variant locals — same union as 2.
  5. spawn variant loop — keep main's per-attempt `recordGhCallLogEntry(... outcome: 'call', ok: !failed)`; then the branch's early return / exhausted return (plus main's `retry_exhausted` entry) / calibrated `sleep(backoff.ms)`.
  Verify main's `acquireGhPointsSync` still wraps every attempt after the union.
- `we:scripts/lib/__tests__/gh-throttle.test.mjs` — 1 region (import list): union `DEFAULT_GH_POINTS_BUDGET_PER_MIN, GH_POINTS_WINDOW_MS, resolveGhPointsBudgetPerMin` + `DEFAULT_HEADER_WAIT_CAP_MS, resolveHeaderWaitCapMs`.
- `we:scripts/pr-land.mjs` — clean direct 3-way (main `d622b4d80` `admittedArgv`, `497de6f49`, `f48582572`).
- `we:scripts/conveyor/lease-reaper.mjs` + test — clean direct 3-way (main `f211888d0` multi-repo).
- `we:scripts/lib/forge-land-provider.mjs` (+test), `we:scripts/__tests__/pr-land.test.mjs`, `we:scripts/operations/host-process-sample.mjs` (+test) — main untouched / new; apply as-is.
