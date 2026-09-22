# Backlog split analysis — 2026-09-22

## Candidate

**#3860** — *Daemonize the conveyor headless runner into independently-runnable processes* (`kind: story`,
`size: 8`, `parent: "3383"`, `status: open`). Filed 2026-09-21 after 3 rounds of jury review plus a direct
read of all 16 relevant scripts on `lane/mechanical-dispatcher`. Its own "Done when" section is still a
placeholder (`TODO`) — it names six components across ~18 files with real sequencing, which is epic-shaped
work filed under a story kind.

## Investigation

Every proposed slice below is grounded in the branch's actual code (`origin/lane/mechanical-dispatcher`),
read directly, not inferred from #3860's body:

- **`gh` calls not yet routed through the shared throttle.** `we:scripts/conveyor/reconcile-pass.mjs:85`,
  `we:scripts/conveyor/parked-pr-conflict-watch.mjs:236,280,297,321`,
  `we:scripts/conveyor/parked-pr-progress-watch.mjs:276,293,311,323`,
  `we:scripts/conveyor/duplicate-pr-watch.mjs:239,257`, and
  `we:scripts/conveyor/reconcile-fix-dispatch.mjs:187,259` all default an injectable `exec` parameter to raw
  `execFileSync`. `we:scripts/conveyor/ci-queue-watch.mjs:48,189` already proves the swap-in pattern
  (`exec = execFileSyncThrottled` from `we:scripts/lib/gh-throttle.mjs`) — same call signature.
- **we:runner-lock.mjs's lease key is a hardcoded constant.** `we:skills-src/conveyor/runner-lock.mjs:47`
  (`RUNNER_LEASE_PATH`), used unparameterized at lines 57/59/72/74/80/81/83/88/89/90/102. Needs an optional
  `key` param threaded through, defaulting to today's constant.
- **we:verify-dispatch.mjs's only safety argument is borrowed.** `we:scripts/conveyor/verify-dispatch.mjs:23-27`
  states outright: "the runner is a SINGLETON... so there is no risk of two dispatches racing the same
  lane's marker" — a property that lives in `we:skills-src/conveyor/runner.mjs`, not in this file. It holds no lock of its own.
- **Only we:review-dispatch.mjs self-checks main freshness today.** `we:scripts/operations/review-dispatch.mjs:375`
  (`assertMainNotStale`) is the one self-contained staleness check on the branch; nothing else (watchers,
  fix-dispatch, verify) has an equivalent.
- **The 8 watcher passes already carry their own separate locks**, none touching the shared tick mutex:
  `we:scripts/conveyor/ci-queue-watch.mjs` (`withHistoryLock`), `we:scripts/conveyor/infra-blocked.mjs` (`withInfraLock`, its own header reasoning
  about concurrent writers), `we:scripts/conveyor/poc-branch-sync.mjs` (`withPocLandLock`, shared with a real PR landing),
  `we:scripts/conveyor/lane-pool-health-watch.mjs` (a TOCTOU re-check gating its own mutation); `we:scripts/conveyor/branch-drift.mjs`,
  `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `we:scripts/conveyor/parked-pr-progress-watch.mjs`, `we:scripts/conveyor/duplicate-pr-watch.mjs` need no lock.
- **we:reconcile-fix-dispatch.mjs and we:review-dispatch.mjs already fence dispatch through a durable ledger**
  (`we:scripts/operations/action-store.mjs`, atomic `fs.openSync(path,'wx')` per-resource claims) —
  independent of the tick mutex, already cross-process-safe.
- **we:supervisor.mjs's restart/backoff core already takes an injected child.**
  `we:skills-src/conveyor/supervisor.mjs:189` (`runSupervisorLoop`), `:422` (`makeRealSpawnChild`), `:587`
  (`main`) — no internal rewrite needed to run N of it; a thin launcher can start one unmodified
  `we:skills-src/conveyor/supervisor.mjs` per manifest entry.
- **Credential/token scoping has no existing mechanism at all** — this is a genuine open design fork
  ("decide the credential infrastructure"), not a code gap a slice can close.

## Could split

**#3860** splits. Rubric check: (1) the one buried decision (credential scoping) is carved into its own
`kind: decision` card, never bundled into a build slice; (2)–(5) hold for the 9 slices below — each is
independently nameable, re-estimates to `task`/`size ≤5`, the DAG is acyclic with 5 of 9 slices startable
with zero blockers, and each slice ships something demoable on its own (a swapped call site + test, a
lock/lease change + test, a standalone daemon process + a smoke test).

Because #3860 already has a `parent` (#3383), it is **not** converted to an epic — it stays a resized
`story` for its own core slice, and the rest are filed as siblings under `parent: 3383`.

| # | Title | Kind/size | Scope (predicted touch-set) | `blockedBy` |
|---|---|---|---|---|
| **#3860** (resized) | Route the 5 raw `gh` call sites through we:gh-throttle.mjs | task, ≤3 | `we:scripts/conveyor/reconcile-pass.mjs`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `we:scripts/conveyor/parked-pr-progress-watch.mjs`, `we:scripts/conveyor/duplicate-pr-watch.mjs`, `we:scripts/conveyor/reconcile-fix-dispatch.mjs` | — |
| **NEW A** | Key we:runner-lock.mjs's lease so more than one daemon can hold a distinct singleton lease | task, ≤3 | `we:skills-src/conveyor/runner-lock.mjs` | — |
| **NEW B** | Extract assertMainNotStale into a shared freshness helper | story, ≤5 | `we:scripts/operations/review-dispatch.mjs`, new `we:scripts/lib/main-freshness.mjs` | — |
| **NEW C** | Extract the Fix-dispatch daemon (we:reconcile-fix-dispatch.mjs) to run standalone | story, ≤5 | `we:scripts/conveyor/reconcile-fix-dispatch.mjs`, `we:skills-src/conveyor/runner.mjs`, `we:scripts/operations/action-store.mjs` (read-only) | — |
| **NEW D** | Build we:pass-daemon.mjs (generic single-pass loop, closed script-allowlist, own heartbeat timer) + the manifest schema | story, ≤5 | new `we:skills-src/conveyor/pass-daemon.mjs`, new `we:skills-src/conveyor/daemon-manifest.mjs` | — |
| **NEW E** | Extract the Verify daemon (we:verify-dispatch.mjs) to run standalone under its own keyed lease | story, ≤5 | `we:scripts/conveyor/verify-dispatch.mjs`, `we:skills-src/conveyor/runner-lock.mjs`, `we:skills-src/conveyor/runner.mjs` | NEW A |
| **NEW F** | Extract the Review daemon (we:reconcile-pass.mjs + we:review-dispatch.mjs + the two tag scripts) to run standalone | story, ≤5 | `we:scripts/conveyor/reconcile-pass.mjs`, `we:scripts/operations/review-dispatch.mjs`, `we:scripts/conveyor/review-round-tag.mjs`, `we:scripts/conveyor/review-status-tag.mjs`, `we:skills-src/conveyor/runner.mjs` | #3860 (same file, we:reconcile-pass.mjs) |
| **NEW G** | Wire all 8 watcher passes onto we:pass-daemon.mjs, one manifest entry each | story, ≤5 | `we:scripts/conveyor/branch-drift.mjs`, `we:scripts/conveyor/ci-queue-watch.mjs`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `we:scripts/conveyor/parked-pr-progress-watch.mjs`, `we:scripts/conveyor/duplicate-pr-watch.mjs`, `we:scripts/conveyor/lane-pool-health-watch.mjs`, `we:scripts/conveyor/poc-branch-sync.mjs`, `we:scripts/conveyor/infra-blocked.mjs`, `we:skills-src/conveyor/runner.mjs` | NEW D |
| **NEW H** | Supervisor manifest launcher (spawns one unmodified we:supervisor.mjs per manifest entry) | story, ≤5 | new launcher under `we:skills-src/conveyor/`, `we:skills-src/conveyor/supervisor.mjs` (read-only reuse) | NEW D |

**DAG:** `#3860`, `NEW A`, `NEW B`, `NEW C`, `NEW D` have no blockers — 5 of 9 slices are batchable right now,
in parallel. `NEW E` waits only on `NEW A`. `NEW F` waits only on `#3860` (same file, sequenced to avoid
rework rather than a real correctness dependency). `NEW G` and `NEW H` both wait only on `NEW D`. No slice
waits on more than one predecessor; the graph is acyclic.

**Note on `NEW B`:** its extraction doesn't block `NEW C`/`NEW E`/`NEW F`/`NEW G` from *landing* — the
audited passes tolerate a bake period without their own freshness check (their existing locks/ledgers are
what makes them safe, not main-staleness). It matters for the *final* cutover step (dropping a pass from
`we:skills-src/conveyor/runner.mjs`'s own list), which each of those slices' own "Done when" should call out as its last step,
not as a hard `blockedBy`.

## Could not split

None — #3860 splits cleanly once the credential-scoping fork is carved out separately (see below).

## Filed separately (not a build slice — rubric condition 1)

**Per-daemon credential/token scoping** — no mechanism exists today to give one daemon a narrower GH/CI
credential than another; every process would inherit the same environment (today's status quo, unchanged
by any slice above). This is an open design fork ("decide the credential infrastructure — a GH App vs.
fine-grained tokens per daemon role"), not something a code slice can resolve. File as its own
`kind: decision` card under `parent: 3383`, blocking none of the 9 build slices.
