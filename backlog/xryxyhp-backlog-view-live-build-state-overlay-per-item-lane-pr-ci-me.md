---
kind: story
size: 5
parent: "x0xjkr7"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: live build-state overlay — per-item lane / PR / CI / merged

Beyond the **durable** state authored in each item file (status / kind / size / tags, which the read foundation already renders), overlay the **live pipeline state** per item: claimed by a session, queued, PR open, CI status, merged.

The join is item → PR via the lane manifest — the same manifest the drain uses to map a lane's work to its PR — so each row can show where its work actually is in the pipeline right now, not just what its file says.

Deferred behind the v1 read foundation ([read-only backlog view](/backlog/xjaj8e8-backlog-view-v1-read-only-backlog-view-in-plateau/)) and the data-path decision ([D1](/backlog/xg8fwbk-plateau-loop-how-the-backlog-console-reads-a-repo-s-backlog-/)) — the overlay layers on top of the read view and rides whatever live-data seam D1 fixes. Impl lives in plateau-app; Web Everything holds zero implementation.
