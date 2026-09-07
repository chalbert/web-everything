---
kind: story
size: 5
parent: "xc1idt1"
status: open
scope: ["we:scripts/readiness/heavy-admission.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Stage 1 — sample real CPU/memory usage per heavy-command run and correlate it with heavy-admission slot occupancy (visibility only, no policy change)

First buildable slice of we:backlog/xc1idt1-hardware-usage-aware-heavy-command-capacity-control-a-staged.md. Today we:scripts/readiness/heavy-admission.mjs's cap=2 semaphore sees zero actual resource data — it is a pure command counter (confirmed by reading the file in full: DEFAULT_ADMISSION_CAP is a hardcoded constant, tryAcquireSlot/heldSlots/admissionStatus track only slot ownership + PID liveness, nothing about CPU/memory). This item adds real sampling: at minimum node:os's cpus()/freemem()/loadavg() (cheap, built-in, no new dependency) taken at slot-acquire and slot-release time for each heavy command, written alongside the existing we:scripts/readiness/file-locks.mjs-backed slot metadata (the tryAcquireSlot `meta` param already accepts an arbitrary object) or to a small sidecar the same shape as the admission lock root. Explicitly sequenced with, not parallel to, we:backlog/3569-a-rolling-24h-delivery-capacity-monitor-artifact-lane-utiliz.md (xet3s3v) — that item's own body already concludes 'there is no periodic snapshot of lane-pool state, queue depth, or heavy-admission slot usage anywhere — a rolling-window view needs new, durable time-series capture'; this story's per-heavy-command resource sample is the missing correlated half of that exact same time series (heavy-admission concurrency + queue depth from #3569's side, real CPU/memory from this story's side), so whichever of the two lands first should define the shared persistence shape (repo-committed log vs. the Artifact db capability #3569 floats) and the other should reuse it rather than standing up a second pipeline. Done when: a new sampling helper (co-located with we:scripts/readiness/heavy-admission.mjs) records cpus()/freemem()/loadavg() at acquire and release for every heavy-admission slot, the samples are queryable (a `status`-style read, mirroring we:scripts/readiness/heavy-admission.mjs's existing `admissionStatus`), and this ships NO cap/policy behavior change — DEFAULT_ADMISSION_CAP stays exactly 2, this item is purely additive visibility per the epic's staged plan.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
