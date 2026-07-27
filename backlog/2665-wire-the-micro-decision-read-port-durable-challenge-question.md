---
bornAs: xeq9sha
kind: story
size: 5
parent: "2577"
status: open
blockedBy: ["2650"]
scope:
  - we:scripts/lib/micro-decision-surface.mjs
  - we:scripts/lib/__tests__/micro-decision-surface.test.mjs
  - plateau-app:vite.config.mts
  - plateau-app:src/backlog-view/
dateOpened: "2026-07-25"
tags: []
---

# Wire the micro-decision read port + durable challenge/question record

Close the read-port + persistence seam left by #2650. That slice landed the surfacing half ([we:scripts/lib/micro-decision-surface.mjs](scripts/lib/micro-decision-surface.mjs) — `buildMicroDecisionQueue` over the #2652 per-fork disposition) and the console UI ([plateau-app:src/backlog-view/micro-decision-surface.ts](../plateau-app/src/backlog-view/micro-decision-surface.ts)) view-first, as #2580 preceded its write path. This item wires: (a) a plateau-app read port `GET /api/backlog/micro-decisions` that reads a decision's per-fork jury ledgers and returns the `MicroDecisionSurfaceDTO` via the WE builder; (b) a durable per-fork record for a human **challenge** / **ask-a-question** (today captured client-side only — the durable escalation is "open for full discussion" into the #2577 ruling surface); (c) a nav link into `/console-micro` from the board or ruling surface. blockedBy #2650.

## Scope note (file-level rescope, #2619 finer-lease)

The WE side is exactly one builder file (`we:scripts/lib/micro-decision-surface.mjs` + its test) — narrowed from the
whole `we:scripts/` so this item no longer collides with every other conveyor/readiness item. The plateau side is
kept at feature-dir granularity (`plateau-app:src/backlog-view/`) on purpose: the read handler
(`plateau-app:src/backlog-view/loader.ts`), the durable challenge/question write path, the nav link, and the
`plateau-app:src/backlog-view/micro-decision-surface.ts` view all live inside that one feature directory, so a
file-list would just re-enumerate the dir. `plateau-app:vite.config.mts` is added because the `/api/backlog/*`
routes are registered there (dev-server middleware) — the prior `plateau-app:src/` scope silently missed it (an
under-scope the build would have breached).
