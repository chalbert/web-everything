---
bornAs: xyb1n16
kind: story
size: 3
parent: "2474"
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-07-13"
dateResolved: "2026-07-13"
tags: []
---

# Loop console: finish surface — stuck lanes and take-over/finish state

Surface stuck lanes and their take-over/finish state (the /finish flow) so a human can see and act on producer-abandoned lanes from the console.

## Resolution (2026-07-13)

Shipped in plateau PR #29: a read-only **stuck-lane finish surface** in the `plateau:tools/dev-panel/drain-daemon.html` surface. A pure `summarizeStuck` distills the WE finish flow's discover plan (`we:scripts/lane-resume.mjs discover --json` — classifies stuck lanes across all three repos into conflict / test-red / review-changes / blocked / unknown, blockedBy-ordered) into a board; a `stuck` cli subcommand + `GET /__dev-panel/drain-daemon/stuck` endpoint shell it **on-demand** (the discover sweep spans all repos ~10–30s). The section shows each stuck lane's num / repo / item / why-stuck reason / blockedBy + summary counts, empty → "no stuck lanes". Read-only (running `/finish` spawns finisher subagents — out of v1 scope, noted in the caption). Single-sourced via the WE finish flow.
