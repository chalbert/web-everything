---
kind: story
size: 3
parent: "x6yoscx"
status: open
blockedBy: ["xunndgr", "xegteiq"]
dateOpened: "2026-07-10"
tags: []
---

# Push-at-close: fire one detached lease-checked drain when a serial batch closes

At batch close, we:.claude/skills/batch-backlog-items enqueues via pr-land --label-on-green (already) then checks the whole-process drain lease: free means fire ONE detached self-terminating drain watch (merge-ai-prs --label=ready-to-merge --watch --until-batches-idle) and take the lease; held means only enqueue and let the running drain watch collect it — exactly one drain regardless of how many sessions close. Give the detached launch a bounded max lifetime + a durable feed location so the watch terminates correctly; verify true detachment per platform (nohup/setsid/scheduled). Correctness holds with it off (the deferred sweep is the backstop). Tests: a serial batch lands its chain at close via a separate process; a second concurrent close only enqueues; an interrupted close leaves a drainable queue.
