---
bornAs: xp83iru
kind: story
size: 5
tier: pinned
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "4d568dec4b66cde77cd794ad679de3fb7caffa12"
tags: []
relatedReport: reports/2026-09-30-unmetered-app-graphql-spend.md
---

# Meter every drain GitHub call without relying on the launchd PATH

The resident drain refreshes the App token but bypasses the throttle on synchronous and asynchronous gh calls. PR #3103 CI-heal commit 3dabd061b removed its synchronous adapter; restore coverage with a soak-safe transport and prove ledger capture under the real launchd PATH.

## Evidence and fix design

The incident report is we:reports/2026-09-30-unmetered-app-graphql-spend.md. The live drain sets the App token but launches raw gh under a launchd PATH without the shim. we:scripts/merge-ai-prs.mjs:129 imports both synchronous and asynchronous raw executors; discovery at :4130 and commit reads at :3832 bypass the meter. CI-heal commit 3dabd061b explicitly reverted synchronous coverage before PR #3103 merged. The exact incident hour contains 44 drain passes, including 42 successful passes and 12 merges; the total cost remains unmeasured.

Restore synchronous coverage and add a metered asynchronous transport while retaining bounded concurrency, return/error fidelity, and one ledger event per attempt. Audit descendant utilities and lifecycle raw reads at we:scripts/lib/daemon-edge.mjs:574 and we:scripts/lib/daemon-rebuild.mjs:897; their current empty registries do not establish historical usage. Broaden scope only for independently confirmed reachable paths.

## Done when

1. A transport test invokes both discovery and synchronous guard reads with a launchd-equivalent PATH that contains only the real gh fixture; both reach the meter once and preserve their outputs and failures.
2. The drain soak that timed out during PR #3103 passes with an isolated admission root and realistic concurrency. No coverage adapter is removed to make it pass.
3. An observed production pass records drain attempts, installation provenance, costs or explicit unknown costs, and reset data. Compare matched intervals without claiming that attribution alone reduces consumption.

## Follow-ups

Run the affected transport and drain soak suites and we:scripts/verify-lane.mjs. Keep regression lessons here; do not modify shared agent documentation. Obtain authenticated Actions run counts in a network-enabled follow-up; current source uses built-in workflow tokens, so run actor alone cannot establish App-bucket spend. This card is filed unqueued for human review; no runtime fix was made by the diagnosis.

## Premise check (2026-09-30, against `main` @ 4d568dec4)

Holds. `we:scripts/merge-ai-prs.mjs:129` still imports raw `execFileSync, execFile, spawnSync` from `node:child_process`; the gh call sites bypass the meter: 27 sync `execFileSync('gh', …)` calls (e.g. `:1608`, `:1642`, `:3696`, `:3719`, `:3845`, `:4591`, `:4714`, `:4800`, `:5011`) and 6 async `execFileP('gh', …)` calls (`:3750`, `:3831` commits read, `:3888`, `:4127` discovery list, `:4147`; `execFileP = promisify(execFile)` at `:3402`). `git log` shows `3dabd061b` removed `import { execFileSyncThrottled as execFileSync }` (only that 3-line diff) and nothing has re-added it. `execFileSyncThrottled` (`we:scripts/lib/gh-throttle.mjs:1569`) exists but there is **no async throttled executor** in `we:gh-throttle.mjs` (only `runGhSync`, `:1403`, and the CLI passthrough). Raw reads at `we:daemon-edge.mjs:574` and `we:daemon-rebuild.mjs:897` are unchanged (`spawnSync('gh', …)`). No git log entry for #4655/xp83iru beyond the pin — not already done.

Scope check: frontmatter scope (`we:merge-ai-prs.mjs`, `we:gh-throttle.mjs`, `we:gh-throttle.test.mjs`) matches the real touch-set. The launchd-PATH transport test and any soak fix may add a new test file under `scripts/__tests__/`; the builder widens scope then (the audit of `we:daemon-edge.mjs` / `we:daemon-rebuild.mjs` widens only on a confirmed reachable path, per the card).

## Design

The meter lives in `we:gh-throttle.mjs`; it is reached by name (`execFileSync('gh')` resolving through a shim on `PATH`) or by import. The launchd drain has no shim on `PATH`, so the fix must be **import-based, not PATH-based**.

1. **Sync:** in `we:merge-ai-prs.mjs:129`, route gh calls through `execFileSyncThrottled` (`we:gh-throttle.mjs:1569`), which already delegates `file === 'gh'` to `runGhSync` and falls through to real `execFileSync` for `git`. Keep a plain `execFileSync` binding for the non-gh `git` calls (`:1203`, `:3767`, `:3770`, `:5539`) so they are not double-gated. Do it as a *named* split (`ghExecSync` for gh, raw for git) rather than re-aliasing `execFileSync`, so injectable `exec` seams documented as `execFileSync`-shaped (`:2888`–`:3354`) keep their contract.
2. **Async:** add `execFileAsyncThrottled(file, args, opts)` to `we:gh-throttle.mjs` — promise-returning, `execFile`-shaped (`{stdout, stderr}`; rejection carries `.status/.code/.stdout/.stderr` like `promisify(execFile)`). It must NOT block the event loop: admission uses the non-blocking poll (`acquireGhSlot`/points gate with `setTimeout` sleep), not `sleepSyncMs`, so the bounded-concurrency `Promise` fan-outs at `:3831`/`:4127` keep running in parallel. It writes exactly one `recordGhCallLogEntry` (`:1359`) per attempt with the same fields as `runGhSync` (`:1501`), shares the same lock root/cap/points budget, and preserves retry/backoff semantics. Replace `execFileP` for gh calls (`:3750`, `:3831`, `:3888`, `:4127`, `:4147`); `readRemoteManifestViaApi({ exec: execFileP })` (`:3794`) gets the async adapter too.
   **Cost, stated plainly:** `runGhSync` (`:1403`) carries priority admission/`deferGhPass`, budget blocks, the personal-token route, write classification, cost-header capture, headroom recording and calibrated backoff; only the sleeps in `acquireGhSlotSync`, `acquireGhPointsSync` (`:1074`), `acquireGhWriteBudgetSync` (`:1132`) and the retry backoff are sync-only (`tryAcquireSlot` is already non-blocking). The builder must either refactor `runGhSync` into a shared core with injectable `sleep`/`exec` (recommended — one logic, two transports) or duplicate ~160 lines; duplication is not acceptable. Priority admission may now defer drain passes — a behaviour change to call out in the PR and cover with a parity test.
3. **Soak regression (the reason `3dabd061b` backed out) — cause UNCONFIRMED, treat as hypothesis.** Only evidence is the commit message ("drain soak tick timed out at 90s"; bound is `tickBoundMs`, `we:scripts/conveyor/__tests__/sim/invariants.mjs:33`). The soak world (`we:scripts/conveyor/__tests__/sim/world.mjs:236`) already sets `LANE_POOL_ROOT` and an overridden `HOME`, so its admission root is probably ALREADY isolated — an isolated `WE_GH_THROTTLE_LOCK_ROOT` may be a no-op. Step 0 of the build: reinstate the sync alias, run the soak, and profile where the ~90s goes (candidates: ~33 sequential process spawns of the PATH fake `gh` plus throttle overhead, points budget, `deferGhPass`, cost-header capture via `spawnWithGhDebugCapture`). Then repair that cause in `we:scripts/lib/gh-throttle.mjs` or the drain's call pattern; never remove the adapter. If profiling shows the sync path cannot fit the bound, the soak's tick bound or fake-gh speed is a legitimate input to escalate, not silently widen.
4. **Audit:** grep every `spawnSync('gh'`/`execFile*('gh'` under `scripts/` reachable from the drain entry (`we:merge-ai-prs.mjs` imports), including scripts it spawns (`spawnReviewSetLabel`/`restampAcceptance` spawn `we:scripts/review-set-label.mjs`, whose gh calls are also unmetered drain spend); list confirmed reachable raw paths in the PR body. MVP routes only `we:scripts/merge-ai-prs.mjs`'s own calls; spawned-descendant paths are explicitly OUT (filed as follow-ups), not silently dropped. `we:daemon-edge.mjs:574`/`we:daemon-rebuild.mjs:897` are fixed only if a call chain from the drain/daemon is demonstrated.

## MVP

Musts only:
- `we:merge-ai-prs.mjs` gh calls (sync + async) go through the meter; `git` calls stay raw.
- New `execFileAsyncThrottled` with bounded concurrency, non-blocking wait, error/return fidelity, one ledger line per attempt.
- Transport test under a launchd-equivalent `PATH` (only a real `gh` fixture dir) proving discovery (`:4127`) and a sync guard read (`:3845`) each hit the ledger once.
- Drain soak passes with isolated admission root; adapter stays.
- One observed production pass ledger capture (attempts, identity/installation provenance, cost or explicit `unknown`, reset data).

OUT (Follow-ups): shim fallback metering (#xkcp5vc); regenerating the 162 stale shims; `daemon-edge`/`daemon-rebuild` raw reads unless a reachable chain is confirmed; any claim that attribution reduces consumption; Actions run counts.

## Test plan

The sync guard read (`:3845`), discovery (`:4127`), commit reads (`:3831`) and manifest read (`:3794`) live inside the non-exported `async function runCli()` (`:3540`), so tests 1–2 run the WHOLE CLI as a subprocess (`node we:scripts/merge-ai-prs.mjs …`) against a fixture repo state, unless the builder first extracts an exported seam (then say so in the PR; this is part of the size-5 estimate). The fixture `gh` must be a `#!/bin/sh` script (a node shebang fails with `env`/`node` absent from the restricted PATH).

1. **sync-launchd-path** (new `we:scripts/__tests__/merge-ai-prs-gh-metering.test.mjs`): run the CLI with `PATH` = a dir holding only the `sh` fixture `gh`, isolated `HOME`/`WE_GH_THROTTLE_LOCK_ROOT`; assert the sync guard read yields exactly one `calls.jsonl` line, output passes through, and a fixture exit 1 still surfaces `.status === 1`. RED today: raw `execFileSync` writes no ledger line (count 0).
2. **async-discovery-ledger:** same run; assert the discovery list call yields one ledger line and parsed rows are used. RED today: `execFileP` bypasses the meter (count 0).
3. **async-fidelity** (`we:scripts/lib/__tests__/gh-throttle.test.mjs`): `execFileAsyncThrottled` rejects with `.code/.stdout/.stderr` like `promisify(execFile)`; success returns `{stdout, stderr}`; `maxBuffer` honoured. RED only because the function does not exist (a new-API test, stated honestly).
4. **async-concurrency:** 12 concurrent calls, cap 6 → never >6 in flight, event loop not blocked (a timer ticks during admission waits). New-API test; its failure mode is a sync-wrapped implementation.
5. **async retry ledger:** fixture rate-limited once then success → two lines (`attempt` 1, 2), no duplicates; plus a sync-vs-async PARITY test over the same fixtures for priority admission/`deferGhPass`, budget-block, and write-budget outcomes (same ledger `outcome` values from both transports). New-API test (sync path already passes).
6. **no raw gh left:** static assertion that `we:scripts/merge-ai-prs.mjs` has no `execFileSync('gh'`, `execFileP('gh'` or `exec('gh'` (manifest reader at `:1500`) literals outside the metered adapters. RED today (~33 hits: 27 sync + 6 async).
7. **drain soak:** after step 0 of Design item 3 (reinstate alias, reproduce and profile the timeout), the existing soak (`daemon-soak` CI job, `we:scripts/conveyor/soak/daemon-soak.soak.test.mjs`) finishes inside `tickBoundMs` with the adapter present. RED only with the alias reinstated and before the cause is fixed; today the soak passes because the adapter is absent.

## Proof plan

- **Before/after ledger on the real surface:** before the change, run one real drain pass (`node we:scripts/merge-ai-prs.mjs --json` or the resident daemon's command) under the launchd `PATH` (from `com.plateau.drain-daemon.plist`, no shim) and count new `calls.jsonl` lines for the drain process (first confirm how `deriveGhCaller` (`we:scripts/lib/gh-throttle.mjs:486`) labels the launchd drain env — if it isn't `drain`, key the count on pid/time window instead; expect ~0); after, the same pass shows one line per gh attempt with `id` (installation provenance), `points`/cost or `unknown`, and reset data from `recordGhHeadroom`.
- Matched-interval comparison: sample `gh api rate_limit` (App token) at the start and end of the observed pass and sum ledger points over the same timestamps; report the ratio, do not claim attribution lowers spend. If no network/credentials are available to the builder, deliver the launchd-PATH ledger capture against the fixture `gh` and mark the live pass `blocked-on-infra` for the operator rather than claim it.
- Reproduce the 90s soak timeout on the parent commit of `3dabd061b` once (record cause), then show the fixed branch passes with the adapter in place.
- Run `node we:scripts/verify-lane.mjs` and the affected suites (`gh-throttle*`, `merge-ai-prs-*`, soak).

## Follow-ups

- #xkcp5vc — stable fallback meter for shim missing-throttle fallback (already filed).
- Meter gh calls in scripts the drain spawns (`we:scripts/review-set-label.mjs` via `spawnReviewSetLabel`/`restampAcceptance`) — own card per confirmed path.
- Regenerate stale shims via their owner; verify active-process adoption separately.
- Audit `we:daemon-edge.mjs:574` / `we:daemon-rebuild.mjs:897` / `we:scripts/lib/daemon-live-smoke.mjs` smoke shims for a reachable drain chain; file a card per confirmed path.
- Authenticated Actions run counts in a network-enabled session (App-bucket spend attribution).
- Consider a lint rule banning raw `gh` exec in drain-reachable modules.

## Progress

2026-09-30 — investigation in lane-43; implementation and required proof remain incomplete.

- Confirmed `3dabd061b` removes only the synchronous throttle import from we:scripts/merge-ai-prs.mjs. Temporarily restored that adapter to attempt the pre-fix reproduction; removed the diagnostic edit afterwards because no drain tick reached execution. This is not a fix or an attribution claim.
- Baseline: `npx vitest run we:scripts/lib/__tests__/gh-throttle.test.mjs` (strip the `we:` prefix when executing locally) passed all **81 tests** in **635 ms**.
- Before-proof attempt: the normal couple-split drain soak, we:scripts/conveyor/soak/breaks/couple-split-by-unrelated-merge.soak.test.mjs, failed before tick 1 with `ENOTEMPTY` deleting a temporary Git fixture. Repeating with a different temporary root produced the same failure. The stale-label soak, we:scripts/conveyor/soak/breaks/ci-heal-loop-stale-label-review-gate.soak.test.mjs, reported an expected-failure pass despite the same setup crash: **zero ticks is not drain proof**.
- A diagnostic-only preload retained temporary template repositories instead of deleting them; setup then failed cloning the simulator repository with `fatal: unable to read tree`. No tick bounds, assertions, repository tests, or gates were edited. Neither diagnostic run reproduces the historical 90-second timeout; its cause remains unproven.
- Transport audit: discovery, manifest API reads, per-PR commits and default-branch reads use the raw async executor. Synchronous guards and mutations use the raw sync executor. In addition, the drain calls `mergePr` and `retargetStackedPrs` without supplying their injectable executor; both default to raw GitHub calls in we:scripts/lib/pr-merge-gate.mjs. A complete transport change must inject the metered executor there too. The raw lifecycle reads in we:scripts/lib/daemon-edge.mjs and we:scripts/lib/daemon-rebuild.mjs were confirmed in source, but no executing drain path to them was established; no scope expansion was made.
- Production-proof attempt: a read-only authenticated `gh api graphql` rate-limit query failed with `error connecting to api.github.com`. No production pass, installation-labelled cost/reset observation, or matched before/after interval was obtained.
- Required verification: `node we:scripts/verify-lane.mjs` (local execution without `we:`) selected **56 targets** for the temporary adapter change, then exited **1** before running them: `EPERM` writing its marker under we:.git/.lane-verify.*.tmp. This checkout's configured filesystem permissions make we:.git read-only. The marker gate was not bypassed.

- Final card-only verification again failed at the read-only marker write. `npm run check:standards` initially failed creating the host admission directory; rerunning with an isolated temporary `LANE_POOL_ROOT` passed with **0 errors and 4,520 warnings**. `git diff --check` passed.

No runtime change is retained. Keep this card open: the soak timeout reproduction, soak-safe synchronous/asynchronous transport, regression test, successful lane verification and production before/after proof are still owed. Resume in an environment where the normal Git-fixture soak, verification marker write and authenticated production observation can run.
