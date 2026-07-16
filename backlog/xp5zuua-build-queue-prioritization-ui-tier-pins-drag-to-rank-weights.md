---
kind: story
size: 5
parent: "xk0eti5"
status: open
blockedBy: ["xwms7q8"]
dateOpened: "2026-07-16"
tags: [plateau-loop, build-queue, prioritization, console]
---

# Build-queue prioritization UI — tier pins, drag-to-rank, weights config, ordered queue view

The console surface for the prioritization engine (slice A, `we:backlog/xwms7q8-build-queue-prioritization-data-model-engine-tier-lexorank-r.md`). In the plateau-app backlog console: pin an item's tier, drag-to-reorder its rank within a tier, edit the scoring weights/criteria in a config panel, and read the resulting **ordered build queue** (ready items only, in `next-to-build` order). Read + the writes ride the existing lane-gated write seam; the queue view reflects the engine's deterministic ordering, so a user sees exactly what the builder will pull next. Prioritization controls never expose `blockedBy`/readiness as editable — those stay upstream.

**Acceptance:** the console shows an ordered build-queue view (ready items, `next-to-build` order, top = built next); a tier control pins/repins an item; drag-to-reorder sets its rank (persisted via the write seam); a weights/criteria config panel edits the config (validated: sum 100%, ≤5, none >50%) and the queue re-orders live; the view surfaces *why* an item ranks where it does (tier + score); no control can edit `blockedBy` or readiness.
