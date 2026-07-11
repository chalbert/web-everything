---
kind: story
size: 3
status: open
dateOpened: "2026-07-10"
relatedTo: ["2413"]
tags: [lane-pool, workflow, orchestrator, lease]
---

# Parallel /workflow dispatch couples items to foreign-leased lanes — skip held lanes at coupling time

Parallel /workflow dispatch couples item→lane by array position off we:scripts/lane-pool.mjs list, which enumerates every lane-N dir with no lease check. A lane held by a foreign live lease (another session's acquire) still gets assigned, so its item is dropped/carried with zero work — direct throughput loss (run wf_9a7f9f43-594, 2026-07-10: 2 of 6 lanes lost, items #2399/#2403). Fix at provision/coupling time: filter lanes via we:scripts/lib/lane-lease.mjs's existing isLaneAcquirable/isForeignLease before assigning positions, or provision extra lanes to cover held ones.

## Mechanism (verified 2026-07-10)

- `cmdList`/`existingLanes` (we:scripts/lane-pool.mjs) enumerate every `lane-N` directory with zero lease
  filtering; the orchestrator's coupling (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js,
  `repoLanePlan`/`laneIndexOf`) assigns item→lane purely by position off that list and never calls `acquire`,
  so the lease-aware `isLaneAcquirable`/`chooseFreeLane` logic is never consulted at coupling time.
- The lane agents themselves then hit the #2367 destructive-git-op guard on `git reset --hard` (the lease is
  foreign) and correctly refuse to clobber — so the failure is safe but total: the item is carried with zero
  work.

## Boundary vs #2413

#2413 is guard **safety** (make dispatch stamp per-lane leases so the guard can deny a sibling's clobber);
this item is **throughput** (never couple onto a lane that is unusable in the first place). An
acquire-at-dispatch design could address both, but neither item's acceptance bar guarantees the other:
an explicit `acquire --lane=N` on a foreign-leased lane hard-fails with no fallback, so even a landed #2413
still drops the item — this item wants the coupling to *pick a different lane* instead.

## Acceptance

- Provision/coupling never assigns an item to a lane whose live lease is foreign (`isForeignLease` true).
- With N items and ≥N acquirable lanes (after filtering), all N items get worked — none carried for lease
  reasons.
- If fewer acquirable lanes than items exist, the orchestrator provisions extras (or queues), and `log`s the
  contention instead of silently carrying.
