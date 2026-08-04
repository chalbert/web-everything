---
bornAs: xj4caam
kind: task
status: open
dateOpened: "2026-08-04"
relatedReport: reports/2026-08-04-review-pipeline-unblock-plan.md
tags: [review, conveyor, orchestrator-mechanization, planning]
relatedTo: ["2572", "2864", "2639", "2830", "2874"]
---

# Review pipeline unblock plan — critical path and parked design decisions

The board state, the one rule while PRs are blocked, and every design decision from 2026-08-03/04 — captured so
nothing is lost, and explicitly **not scheduled** so nothing is started early.

The rule the plan exists to enforce: **open no PR that does not unblock an existing PR.** Eleven PRs are open and
most are parked; every good idea from those two days would become another item, another lane, another PR and
another review, into the queue that is already stuck. Five design decisions are recorded in the report with an
explicit trigger — zero `review:pending` PRs *and* #2572 landed — rather than filed as five separate items that
would compete for capacity now.

Critical path is one operator action: **land PR #1031**, which makes
`we:scripts/workflows/review-parked-prs.mjs` launchable at all. It has been unlaunchable since it was written
(its `meta` used string concatenation, which the Workflow runtime rejects), and three layers of built machinery —
the jury ledger, the scheduled runner, the operator's own queueing — inherited that silence.

Close this item when the report's critical path is done and #2572 has landed; the report is obsolete at that
point, not before.
