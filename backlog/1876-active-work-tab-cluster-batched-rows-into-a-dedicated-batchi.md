---
kind: story
size: 3
status: resolved
blockedBy: ["1854"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "we:src/backlog.njk#active-batches + we:src/assets/js/backlog-active.js"
tags: []
---

# Active-work tab: cluster batched rows into a dedicated Batching lane

Follow-up to #1854. A running batch's active items currently render in the Building lane with a we: ⊘ batch- badge (the live session→batch link); cluster them under a dedicated Batching lane instead, since lane membership is build-time but the batch link is runtime — needs client-side regrouping from the polled feed (we:active-progress.json digests carry the batch slug).
