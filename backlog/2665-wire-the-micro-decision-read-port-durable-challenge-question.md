---
bornAs: xeq9sha
kind: story
size: 5
parent: "2577"
status: open
blockedBy: ["2650"]
scope: ["plateau-app:src/", "we:scripts/"]
dateOpened: "2026-07-25"
tags: []
---

# Wire the micro-decision read port + durable challenge/question record

Close the read-port + persistence seam left by #2650. That slice landed the surfacing half ([we:scripts/lib/micro-decision-surface.mjs](scripts/lib/micro-decision-surface.mjs) — `buildMicroDecisionQueue` over the #2652 per-fork disposition) and the console UI ([plateau-app:src/backlog-view/micro-decision-surface.ts](../plateau-app/src/backlog-view/micro-decision-surface.ts)) view-first, as #2580 preceded its write path. This item wires: (a) a plateau-app read port `GET /api/backlog/micro-decisions` that reads a decision's per-fork jury ledgers and returns the `MicroDecisionSurfaceDTO` via the WE builder; (b) a durable per-fork record for a human **challenge** / **ask-a-question** (today captured client-side only — the durable escalation is "open for full discussion" into the #2577 ruling surface); (c) a nav link into `/console-micro` from the board or ruling surface. blockedBy #2650.
