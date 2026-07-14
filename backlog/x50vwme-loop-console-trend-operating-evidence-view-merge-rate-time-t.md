---
kind: story
size: 3
parent: "2445"
status: open
dateOpened: "2026-07-14"
tags: []
---

# Loop console: trend / operating-evidence view — merge rate, time-to-land, park rate, human-pull-ins over time

The console's counters are point-in-time: current queue depth, last pass result, live badges. They answer "what is true now," not "how has the loop behaved over time." Add a trend view over the drain journal: merge rate over time, time-to-land per PR, park rate, and how often a human was pulled in. This is exactly the operating evidence the #2456 evidence gate needs to answer #2449's questions — so visualize it on the console rather than reconstruct it by hand from journals every time the evidence is due.

## Grounding

#2456 (open) asks a human to read `plateau:.drain-daemon/history.jsonl` + `plateau:.drain-daemon/state.json` after weeks of operation and answer whether drain-class incidents stopped, how often restart-recovery ran, and whether the extraction wants to grow. That reconstruction is manual today. A trend view turns the same journal into standing charts, so the evidence is always on the console instead of being reassembled per review.

## Scope

- Merge rate over time (merges per pass / per hour).
- Time-to-land distribution (queued → merged).
- Park rate (fraction of PRs that escalate to review).
- Human-pull-in frequency (how often `review:human` was needed).

Derive from the existing journal, same pure-composer pattern as `buildStatusReport` — no daemon change. Relates to #2456. Impl lives in plateau-app; WE holds zero impl (this card is the tracker).
