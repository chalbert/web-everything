---
bornAs: x8v2xw9
kind: story
size: 5
parent: "3443"
status: resolved
blockedBy: ["3895"]
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/forge-land-provider.mjs", "we:scripts/lib/__tests__/forge-land-provider.test.mjs", "we:scripts/pr-land.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/operations/host-process-sample.mjs", "we:scripts/operations/__tests__/host-process-sample.test.mjs", "we:scripts/operations/__tests__/telemetry.test.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/lib/review-core.mjs", "we:scripts/lib/jury-core.mjs", "we:scripts/operations/run-store.mjs", "we:scripts/operations/dispatch-providers/build.mjs", "we:scripts/operations/effect-executor.mjs", "we:scripts/operations/delivery-agent-marker.mjs", "we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/run-record.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/open-pr.mjs", "we:scripts/operations/delivery-report-store.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Graduate land path, gh-throttle, lease-reaper and host-process-sample from lane/mechanical-dispatcher to main

Ports we:scripts/lib/gh-throttle.mjs, we:scripts/lib/forge-land-provider.mjs, we:scripts/pr-land.mjs, we:scripts/conveyor/lease-reaper.mjs and we:scripts/operations/host-process-sample.mjs, plus their tests. Graduation slice of epic #3443, split out of #3487 on 2026-09-22. FAITHFUL PORT: no behaviour change; port from snapshot 600acc14f of origin/lane/mechanical-dispatcher and diff-merge every file main has also changed (see the merge notes on this card). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/gh-throttle.test.mjs we:scripts/lib/__tests__/forge-land-provider.test.mjs we:scripts/__tests__/pr-land.test.mjs we:scripts/conveyor/__tests__/lease-reaper.test.mjs we:scripts/operations/__tests__/host-process-sample.test.mjs we:scripts/operations/__tests__/telemetry.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

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

**Moved here from #3895 (2026-09-24, at #3895 land time):** `we:scripts/operations/__tests__/telemetry.test.mjs` — it statically imports `we:scripts/operations/host-process-sample.mjs`, this card's own scope, so it cannot load until this slice ports that file. #3895 ported `we:scripts/operations/telemetry.mjs` and `we:scripts/operations/telemetry-store.mjs` (which this test also exercises) without it; both were confirmed untouched by main since the merge base and are byte-identical to the branch snapshot.

## Graduation import check

- 2026-09-25: graduation-import-check added blockedBy #4178 — the moved-in `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs` also imports a module #4178 owns.
- 2026-09-25: graduation-import-check moved `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs` here from #4178 — it imports a module this card owns.
- 2026-09-25: graduation-import-check added blockedBy #4178 — `we:scripts/pr-land.mjs` imports a module #4178 owns.
- 2026-09-25: graduation-import-check added blockedBy #4178 — `we:scripts/operations/deliver-item-wrapper.mjs` imports a module #4178 owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/telemetry.test.mjs` to #4180 — it imports a module #4180 owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/host-process-sample.test.mjs` to #4180 — it imports a module #4180 owns.
- 2026-09-25: graduation-import-check added blockedBy #4178 — `we:scripts/lib/review-escalation.mjs` imports a module #4178 owns.
- 2026-09-25: graduation-import-check added blockedBy #4178 — `we:scripts/lib/gh-throttle.mjs` imports a module #4178 owns.
- 2026-09-25: graduation-import-check added blockedBy #4178 — the moved-in `we:scripts/lib/__tests__/gh-throttle.test.mjs` also imports a module #4178 owns.
- 2026-09-25: graduation-import-check added blockedBy #4178 — `we:scripts/conveyor/lease-reaper.mjs` imports a module #4178 owns.
- 2026-09-25: graduation-import-check added we:scripts/operations/run.mjs to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/deliver-item-wrapper.mjs`, which this card ports.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/delivery-report-store.mjs` here from #3906 — this card's `we:scripts/operations/deliver-item-wrapper.mjs` needs it directly, and a blockedBy edge to #3906 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/open-pr.mjs` here from #3906 — this card's `we:scripts/operations/deliver-item-wrapper.mjs` needs it directly, and a blockedBy edge to #3906 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/deliver-item-wrapper.mjs` here from #3906 — this card's `we:scripts/operations/deliver-item-run.mjs` needs it directly, and a blockedBy edge to #3906 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/run-record.mjs` here from #3907 — this card's `we:scripts/operations/run-store.mjs` needs it directly, and a blockedBy edge to #3907 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/deliver-item-run.mjs` here from #3906 — this card's `we:scripts/operations/dispatch-providers/build.mjs` needs it directly, and a blockedBy edge to #3906 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/delivery-agent-marker.mjs` here from #3906 — this card's `we:scripts/operations/dispatch-providers/build.mjs` needs it directly, and a blockedBy edge to #3906 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/effect-executor.mjs` here from #3907 — this card's `we:scripts/operations/dispatch-providers/build.mjs` needs it directly, and a blockedBy edge to #3907 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/dispatch-providers/build.mjs` here from #3906 — this card's `we:scripts/operations/dispatch-lane-io.mjs` needs it directly, and a blockedBy edge to #3906 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/run-store.mjs` here from #3907 — this card's `we:scripts/operations/dispatch-lane-io.mjs` needs it directly, and a blockedBy edge to #3907 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/lib/jury-core.mjs` here from #3907 — this card's `we:scripts/lib/review-core.mjs` needs it directly, and a blockedBy edge to #3907 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/lib/review-core.mjs` here from #3907 — this card's `we:scripts/pr-land.mjs` needs it directly, and a blockedBy edge to #3907 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/lib/review-escalation.mjs` here from #3907 — this card's `we:scripts/pr-land.mjs` needs it directly, and a blockedBy edge to #3907 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/dispatch-lane.mjs` here from #3906 — this card's `we:scripts/conveyor/lease-reaper.mjs` needs it directly, and a blockedBy edge to #3906 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check moved `we:scripts/operations/dispatch-lane-io.mjs` here from #3906 — this card's `we:scripts/conveyor/lease-reaper.mjs` needs it directly, and a blockedBy edge to #3906 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check made this a blocker of #3906 — its moved-in `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` to #3906 — it imports a module #3906 owns.
- 2026-09-25: graduation-import-check moved `we:scripts/__tests__/pr-land.test.mjs` to #3910 — it imports a module #3910 owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its `we:scripts/conveyor/reconcile-fix-dispatch.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its moved-in `we:scripts/conveyor/__tests__/reconcile-core.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3907 — its `we:scripts/lib/review-escalation.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3906 — its `we:scripts/operations/dispatch-providers/prepare-decision.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3906 — its `we:scripts/operations/dispatch-providers/build.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3906 — its `we:scripts/operations/dispatch-lane-io.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3903 — its moved-in `we:scripts/operations/__tests__/open-pr.test.mjs` imports a module this card owns.
- 2026-09-24: graduation-import-check moved `we:scripts/operations/__tests__/telemetry.test.mjs` here from #3895 — it imports a module this card owns.

## Left at snapshot 600acc14f — PR #2636 open (2026-09-25)

The epic's tracked prototype tip moved to `6a2c8c1ab` for every not-yet-started slice, but this card already has an open PR (#2636) built from `600acc14f`, so its own snapshot reference is **left unchanged** to avoid invalidating in-flight review. `git diff 600acc14f..6a2c8c1ab --stat` shows this card's own `we:scripts/operations/dispatch-lane-io.mjs` and `we:scripts/operations/dispatch-lane.mjs` both moved further upstream (commit `4f357472d`, "#3784 Rule 6 of #3690 + enforcement flip": a `we:scripts/operations/dispatch-lane-io.mjs` / `we:scripts/operations/dispatch-lane.mjs` diff not present in PR #2636). That post-`600acc14f` delta is **not** this PR's problem — it goes to the post-snapshot tail slice filed alongside this note (dispatch-contracts/rule-enforcement tail card, parent #3443), which diff-merges it onto whatever `we:scripts/operations/dispatch-lane-io.mjs` / `we:scripts/operations/dispatch-lane.mjs` look like on `main` AFTER PR #2636 lands (that tail card is `blockedBy: ["3915", ...]` for exactly this reason).

**`node we:scripts/graduation-import-check.mjs`'s single `--snapshot` flag applies to every open card in one run — it has no per-card override, and it has no "this card already has a PR, freeze its scope" concept either.** Run at `6a2c8c1ab` (the new epic-wide snapshot) with every OTHER slice's snapshot also moved, it reports 8 residual findings on this card, ALL traceable to the same root cause and deliberately left unapplied:

- `we:scripts/operations/__tests__/host-process-sample.test.mjs`, `we:scripts/operations/__tests__/telemetry.test.mjs` → "later: `we:scripts/operations/telemetry.mjs`, owned by `#4180`, fix → move to `#4180`". Confirmed a pure snapshot-drift artifact: re-running the same check at `--snapshot=600acc14f` makes both disappear (`we:scripts/operations/telemetry.mjs`'s content differs between the two snapshots only via commit `e14f27bef`, `MAX_ATTRIBUTE_KEYS` 40→48, which `#4180` — not this card — will port).
- `we:scripts/conveyor/lease-reaper.mjs`, `we:scripts/lib/gh-throttle.mjs` (+ its test), `we:scripts/lib/review-escalation.mjs`, `we:scripts/operations/deliver-item-wrapper.mjs`, `we:scripts/pr-land.mjs` → "later: `we:scripts/lib/lane-lease.mjs` / `we:scripts/readiness/heavy-admission.mjs` / `we:scripts/lane-pool.mjs` / `we:scripts/check-standards-rules.mjs` / `we:scripts/lib/lane-verify.mjs`, owned by `#4178`, fix → move here / add blockedBy" — these are real static-import facts, not snapshot drift, but the proposed fix (move ownership into this card, or add a `blockedBy: 4178`) does not apply to an already-built PR: `#2636` was built against the pre-`4178`-delta (resolved-card-baseline #3481/#3484/#3890/#3917) content of every one of those files, so this card genuinely needs neither the files themselves nor a landing-order dependency on `#4178`. (An earlier pass DID add `blockedBy: 4178` here per the tool's suggestion, but that created a genuine `4178 → 3915 → 4178` cycle against `#4178`'s own, real `blockedBy: 3915` — dropped in favor of the direction that is actually load-bearing: `#4178` needs THIS card's `we:scripts/lib/review-core.mjs`, not the reverse.)

In every case the underlying files stay exactly where this card's own `scope:` already had them (restored here after `--apply` moved some out) — this card's scope is frozen at `600acc14f`/PR #2636, not up for the mechanical reshuffle the other 600acc14f→6a2c8c1ab-moved slices went through. Re-run the checker once `#2636` lands and this card resolves — every one of these 8 findings disappears on its own, because a resolved card falls outside `--parent=3443`'s open-card scan.
