---
bornAs: xjz3gof
kind: story
size: 5
parent: "4075"
status: active
blockedBy: ["4120"]
scope: ["we:scripts/lib/daemon-jobs.mjs", "we:scripts/operations/run-store.mjs", "we:scripts/operations/run-record.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-28"
tags: []
---

# Job model core: durable job records, detached launch, reattach-on-boot, per-daemon caps

Slice of decision 4120 (daemon job model); audit we:reports/2026-09-24-daemon-blocking-antipatterns.md. Filed uncleared until 4120 is ratified; the shape below follows its bold defaults and changes with the ruling. Build the shared job layer on the existing operations run store (we:scripts/operations/run-store.mjs, we:scripts/operations/run-record.mjs, we:scripts/operations/effect-executor.mjs): a job record {id, kind, input, pid, host, startedAt, heartbeatAt, checkpoint, status, codeSha, attempts} under the daemon's pinned state root; a detached launcher that spawns the job from a pinned code snapshot; a reattach step every daemon runs at boot and each tick (live pid plus fresh heartbeat = leave alone; dead = resume from checkpoint, retry within the cap, or fail visibly); per-daemon concurrency caps and a serial lane for single-writer kinds. Done when: unit tests for record, reattach and caps; LIVE proof: kill -9 a daemon while a no-op test job runs, restart it, and show the job finished once and was not started twice (record timeline in the PR).

## Ruled by 4120 (2026-09-25, statute #daemon-jobs)

The ruling fixes the shape above in these ways:

- **Handle** is `host:pid:procStart`; a bare pid is never a handle. Liveness = the pid exists on this host
  and its start time matches (macOS: `LC_ALL=C ps -o lstart= -p <pid>`).
- **Code version per kind.** A kind declares `readonly-tree` (runs from a pinned code snapshot, lane-pool
  root and state root pinned by env) or `mutates-tree` (runs in its own working tree of `main`, never the
  daemon clone, holding the clone's shared hold only while it runs).
- **Stalled vs dead.** A live pid with a stale heartbeat is stalled: SIGTERM, then SIGKILL, confirm gone,
  then relaunch. A dead handle resumes from the last applied step. Up to 3 attempts with backoff, then fail
  visibly.
- **Sleep detection (ratify red-team finding 2).** Name the detection — the tick's wall-clock gap against
  its monotonic-clock gap — and its threshold, and skip the staleness check only when it fires. Prove it on
  a real sleep/wake and on a live-but-stuck job.
- **Snapshot stores (ratify red-team finding 3).** `node_modules` stores for snapshots are keyed by
  lockfile hash, not `codeSha`; a store no live job references is evicted, keeping at most 2.
- **Where records live — open detail, not ruled.** Each daemon's pinned state root, via
  `OPERATION_RUNS_DIR`. Suggested at ratify: one parent folder `~/.claude/daemon-jobs/<daemon>/` so the
  health daemon scans one place instead of each daemon's scattered state folder. Settle it in this slice.

## Done when

1. **Executable** — unit tests for the record, the handle (pid reuse refused), reattach, caps, the sleep
   rule and store eviction fail before this lands and pass after.
2. **Live** — `kill -9` a daemon while a no-op test job runs, restart it, and show the job finished once and
   was not started twice; freeze a job (SIGSTOP) and show it is killed and relaunched once. Record timelines
   in the PR.

## Progress

- **Built (2026-09-28).** A job is a run-store record kind: an ordinary run record with `op: job:<kind>` and a
  `job` block, validated by `validateRunRecord` (via the pure `validateJobBlock`), so a torn job record is refused
  by the same reader as any run. `isRunRecordTerminal` now keeps a live job out of `pruneTerminalRuns`.
  - `we:scripts/lib/daemon-jobs.mjs`: the pure core. It covers the `host:pid:procStart` handle (a live pid whose
    start time differs is refused as `reused`), the record, reattach and the retry cap (3 attempts, backoff
    30s/60s/…), caps (per-daemon, per-kind, and one serial lane shared by `serial: true` kinds), the sleep rule
    and store eviction. It imports nothing from `node:`, and the engine purity test pins that.
  - `we:scripts/lib/daemon-jobs-io.mjs`: the IO shell. It holds the locked record store, the `LC_ALL=C ps -o
    stat=,lstart=` probe (a zombie counts as dead), SIGTERM→SIGKILL→confirm-gone, the detached launcher and
    `createJobDaemon().tick()`, which is the reattach step run at boot and on every tick.
  - `we:scripts/lib/daemon-jobs-workdir.mjs`: pinned `git archive` snapshots for `readonly-tree`, its own
    `git worktree` for `mutates-tree`, `node_modules` stores keyed by lockfile hash, and eviction to at most 2
    unreferenced.
  - `we:scripts/lib/daemon-job-runner.mjs`: the detached child. It claims attempt N (a stale attempt exits
    without running) and holds the clone's shared read hold only for a `mutates-tree` job. It beats every 10s,
    and a beat that finds another handle on the record fences the child and exits it. It runs the kind's
    `run({input, checkpoint, saveCheckpoint})` and resumes from the last applied step.
  - `we:scripts/lib/daemon-job-kinds/noop.mjs`: the no-op test kind.
    `we:scripts/lib/daemon-jobs-proof.mjs`: the live proofs.
- **Where records live — settled.** One parent folder, `~/.claude/daemon-jobs/<daemon>/` (`DAEMON_JOBS_ROOT`
  overrides the parent), laid out as `jobs/`, `runs/`, `logs/`, `snapshots/`, `stores/` and `worktrees/`. The
  job's children get `OPERATION_RUNS_DIR=<daemon>/runs`, so their run records stay under the daemon's pinned
  state root. Job records are kept apart from the `we:.operations/runs/` sidecar, so a sweep never touches a
  live job.
- **Sleep rule.** The detection is the tick's wall-clock gap minus its monotonic gap, with a threshold of 30s
  (`SLEEP_GAP_THRESHOLD_MS`). When it fires, that tick skips the staleness check but never the dead check.
  Heartbeat age is then measured from the wake, so a job that is really stuck is still killed one stale window
  later. A daemon boot counts as a wake.
- **Executable.** Tests: `we:scripts/lib/__tests__/daemon-jobs.test.mjs` (pure),
  `we:scripts/lib/__tests__/daemon-jobs-io.test.mjs` (real detached processes, covering kill -9 of the job,
  SIGSTOP, a restarted daemon, the retry cap, a real `ps` pid-reuse refusal, fencing, the sleep rule with an
  injected wall clock, the clone hold, and a symlinked workdir) and
  `we:scripts/lib/__tests__/daemon-jobs-workdir.test.mjs` (throwaway git repos).
- **Live, 2026-09-28** — `we:scripts/lib/daemon-jobs-proof.mjs` (`run --scenario=kill-daemon|sigstop`). The job
  ran from a real `git archive` snapshot.

  *kill -9 the daemon mid-job:* the job was started once and finished once, in one attempt.

  | time (UTC) | source | event | detail |
  |---|---|---|---|
  | 15:18:02.308 | proof | start-daemon-1 | pid 48829 |
  | 15:18:02.411 | record | launch | attempt 1 |
  | 15:18:13.641 | job | start | pid 54968 · resume from step 0 |
  | 15:18:15.648 | record | checkpoint | attempt 1 · {"step":2} |
  | 15:18:15.846 | proof | kill -9 daemon | pid 48829 |
  | 15:18:17.355 | proof | job-still-alive? | yes — job pid 54968 kept running without its daemon |
  | 15:18:17.356 | proof | start-daemon-2 | pid 56774 (boot tick: verdict alive, action leave) |
  | 15:18:23.677 | record | checkpoint | attempt 1 · {"step":10} |
  | 15:18:23.678 | job | finish | pid 54968 |
  | 15:18:23.679 | record | succeeded | attempt 1 |

  *SIGSTOP the job:* it was killed as stalled once, relaunched once, resumed from step 2 and finished once.

  | time (UTC) | source | event | detail |
  |---|---|---|---|
  | 15:18:45.229 | job | start | pid 73761 · resume from step 0 |
  | 15:18:47.237 | record | checkpoint | attempt 1 · {"step":2} |
  | 15:18:47.387 | proof | SIGSTOP job | pid 73761 |
  | 15:18:58.274 | record | killed-stalled | stalled: heartbeat 5s old; SIGTERM→SIGKILL |
  | 15:18:58.276 | record | requeued | attempt 1 |
  | 15:19:28.426 | record | launch | attempt 2 |
  | 15:19:28.546 | job | start | pid 89697 · resume from step 2 |
  | 15:19:32.562 | job | finish | pid 89697 |
  | 15:19:32.563 | record | succeeded | attempt 2 |

- **Not proven live: a real host sleep/wake.** Putting the operator's machine to sleep is not something an
  agent should do. The rule is unit-tested with an injected wall clock against a real SIGSTOPped job. The
  daemon also logs `host slept ~Ns; staleness check skipped this tick` whenever the rule fires, so the first
  real sleep of a daemon using this layer will show it in that daemon's log.
- **Live run found a real bug, now fixed.** The runner's entry-point check compared `argv[1]` with
  `import.meta.url`, which never match under a symlinked path (`/var` → `/private/var`), so the child silently
  ran nothing. A regression test covers it.
- **Known cost, follow-up.** The first launch for a new code sha builds the snapshot and clones the
  `node_modules` store inside the tick. That took about 11s here and happens once per sha, or once per
  lockfile for the store. Moving that build off the tick is not in this slice.
