---
bornAs: xjz3gof
kind: story
size: 5
parent: "4075"
status: resolved
blockedBy: ["4120"]
scope: ["we:scripts/lib/daemon-jobs.mjs", "we:scripts/operations/run-store.mjs", "we:scripts/operations/run-record.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
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

- **Records** — a job is a run record with `op: job:<kind>` and a `job` block
  (we:scripts/operations/job-record.mjs, validated by we:scripts/operations/run-record.mjs). Handle is
  `host:pid:procStart`; a bare pid is refused at construction and on read.
- **Where records live (settled here)** — `~/.claude/daemon-jobs/<daemon>/` (`WE_DAEMON_JOBS_ROOT` moves the
  parent; we:scripts/operations/run-store.mjs `daemonJobsDir`). The daemon passes that folder to each child
  as `OPERATION_RUNS_DIR`.
- **Policy** (we:scripts/lib/daemon-jobs.mjs, pure): classify live / stalled / dead / launching / foreign;
  reattach plan (stalled → stop first; dead → resume from checkpoint; 3 attempts with doubling backoff, then
  fail visibly; `resumable: false` kinds restart from step 0); per-daemon cap plus one serial lane; sleep
  rule = wall-clock gap minus monotonic gap between ticks > 10 s skips the staleness check on that tick
  only; snapshot eviction (referenced stores kept, at most 2 in total).
- **Runtime** (we:scripts/lib/daemon-jobs-runtime.mjs): `ps -o lstart=` liveness, a per-record file lock on
  every read-modify-write, detached launch, SIGTERM+SIGCONT → SIGKILL → confirm gone, `reattachTick` /
  `startJobLoop` for daemons, `runJob` for the child (claims only its own launch attempt, refuses a finished
  job, stops writing once superseded).
- **Snapshots** (we:scripts/lib/daemon-job-snapshots.mjs): `git archive` code snapshot per `codeSha`,
  `node_modules` store keyed by lockfile hash and symlinked in; both built in a temp dir and renamed in.
  `mutates-tree` kinds must supply `prepareWorktree` (no default — the adopter slices decide the tree and
  the clone's shared hold).
- **Tests** — we:scripts/lib/__tests__/daemon-jobs.test.mjs, we:scripts/lib/__tests__/daemon-jobs-runtime.test.mjs,
  we:scripts/lib/__tests__/daemon-job-snapshots.test.mjs, we:scripts/operations/__tests__/job-record.test.mjs
  (50 tests; real `ps`, signals, detached spawn, git).
- **Live proof** — `node we:scripts/operations/daemon-jobs-proof/run-proof.mjs all` (2026-09-28, ALL PASS).
  The first live run caught a real bug: `launchedAt` was stamped before a 15 s snapshot build, so the next
  tick read a healthy launch as dead. The child's claim guard refused the duplicate, so no step ran twice.
  The bug is fixed, with a regression test.
  - `kill -9` the daemon mid-job, then restart it: launched 1×, started 1×, finished 1×, each step ran once
    in one process (pid 87950).
    ```
    17:39:32.632Z queued · 17:39:37.206Z launched attempt 1 · 17:39:37.418Z started pid 87950
    17:39:37.465Z daemon 86500 kill -9 (job still alive) · 17:39:38.216Z daemon 88329 boots, reattaches, leaves it
    17:39:38.924Z step 1 · 17:39:40.428Z step 2 · 17:39:41.930Z step 3 · 17:39:41.931Z finished
    ```
  - SIGSTOP the job after step 1: stopped 1× (SIGTERM after SIGCONT), relaunched 1×, resumed from step 1,
    finished 1×; the frozen pid is gone.
    ```
    17:39:47.291Z started pid 91998 · 17:39:48.804Z step 1 · (SIGSTOP)
    17:39:52.039Z stopped SIGTERM · 17:39:52.041Z requeued (heartbeat stale on a live pid)
    17:39:53.061Z launched attempt 2 · 17:39:53.267Z started pid 94717 fromStep 1
    17:39:54.775Z step 2 · 17:39:56.277Z step 3 · 17:39:56.281Z finished
    ```
  - **Not yet proven live: a real host sleep/wake.** That needs the machine put to sleep, which an agent
    should not do on the operator's laptop. The rule has unit coverage (clock gaps, skip only when it
    fires), and the live-but-stuck half is the SIGSTOP run above.
