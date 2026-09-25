---
bornAs: xjz3gof
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["4120"]
scope: ["we:scripts/lib/daemon-jobs.mjs", "we:scripts/operations/run-store.mjs", "we:scripts/operations/run-record.mjs"]
dateOpened: "2026-09-24"
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
