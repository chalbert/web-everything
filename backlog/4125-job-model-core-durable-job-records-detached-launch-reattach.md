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

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
