---
bornAs: xz14x16
kind: story
size: 3
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-11"
dateResolved: "2026-07-11"
graduatedTo: none
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

## Resolution (2026-07-11)

Lease-aware coupling, in two parts:

- **`we:scripts/lane-pool.mjs`** — `list --acquirable` filters out any lane holding a LIVE lease or un-pushed
  work (via the existing `isLaneAcquirable` decision core in `we:scripts/lib/lane-lease.mjs`); the batch holds
  no leases of its own, so every live lease it sees is foreign. `provision --count=N --acquirable` grows the
  pool PAST held lanes (bounded by a headroom cap) so N *acquirable* lanes result, instead of stopping at
  `lane-N` where a low-index hold would occupy a coupling slot. Default (non-`--acquirable`) provision/list are
  unchanged.
- **`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`** — the PROVISION step now runs
  `provision … --acquirable` + `list --json --acquirable`, so `lanePools[repo]` holds only acquirable dirs and
  positional coupling can never land on a foreign-leased lane. Killed the `pool[idx % pool.length]` fallback in
  `laneDirsForItem` (it silently coupled two items onto ONE lane on overflow — the second clobbered the first);
  an overflow item now gets no lane and is carried with an explicit lease-contention `log`.

Covered by `we:scripts/__tests__/lane-pool-acquirable.test.mjs` (leased lane dropped from `--acquirable` but
kept in the bare list; dirty lane dropped; stale lease reclaimable; provision grows past a held low-index lane
to reach N acquirable; non-`--acquirable` provision unchanged). Full suite green (3076 tests, 0 gate errors).

Residual: a lane can still be acquired by a sibling in the window between `list --acquirable` and the lane's
own `git reset --hard` — that TOCTOU safety is #2413's guard (the lane refuses to clobber), and a fuller
acquire-at-dispatch design is tracked by #2413/#2427. This item's scope was throughput (never *couple* onto an
unusable lane), which is delivered.
