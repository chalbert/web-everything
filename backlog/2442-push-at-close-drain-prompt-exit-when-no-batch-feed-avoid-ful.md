---
bornAs: xiojrm2
kind: story
size: 3
parent: "2387"
status: open
priority: low
dateOpened: "2026-07-11"
tags: []
---

# Push-at-close drain: prompt exit when no batch feed (avoid full max-runtime idle poll)

> **Priority note (2026-07-11, Plateau Loop triage).** Efficiency polish of session-choreography a
> resident coordinator replaces wholesale ([#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/)
> — a long-lived drain owner has no detached push-at-close watch to time-box). Correctness is
> unaffected today (bounded by `--max-runtime-min`), so settled-but-low-value-now: pickable, out
> of auto-select.

A serial /batch usually has NO dev active-progress-watch running, so the push-at-close drain's `--until-batches-idle` is INERT (#2330) and it idle-polls until the `--max-runtime-min` cap (default 60m), holding the lease the whole time. Correct + bounded, but wasteful. Make the no-feed case exit promptly after landing the queued chain WITHOUT reintroducing the mid-batch-exit bug that --until-batches-idle fixes: either the launcher writes a durable batch-feed marking THIS batch closed (so the watch's batch-idle exit fires immediately), or the drain detects feed-absence and falls back to a bounded --max-idle only when no feed is present. Feed present (concurrent batch) must still keep collecting.
