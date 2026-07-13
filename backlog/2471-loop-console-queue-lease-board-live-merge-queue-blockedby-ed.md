---
bornAs: xqry5cz
kind: story
size: 5
parent: "2474"
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-07-13"
dateResolved: "2026-07-13"
tags: []
---

# Loop console: queue & lease board — live merge queue, blockedBy edges, lease holder + TTL

Live view of the merge queue the daemon owns: ordered couples, cross-item blockedBy edges, whole-process lease holder + TTL, sole-writer status. Reads the daemon state under plateau:.drain-daemon/.

## Resolution (2026-07-13)

Shipped in plateau PR #26: an on-demand **merge queue & lease board** in the `plateau:tools/dev-panel/drain-daemon.html` surface. A pure `summarizeQueue` distills the WE drain's dry-run plan (`we:scripts/merge-ai-prs.mjs --label=ready-to-merge --dry-run --json` — blockedBy-ordered, merges nothing) into `toMerge` (the ordered queue), `deferred` (blocked couples + their open `waitOn` blocker — the blockedBy edges), `parked`, and `skipped`. A `queue` cli subcommand + `GET /__dev-panel/drain-daemon/queue` endpoint shell it **on-demand** (the dry-run spans all three repos ~10–30s, so it is a button, deliberately not on the 5s status poll). The lease panel shows the drain-lease holder + held/stale state + a "sole writer to main" label + TTL-remaining, derived from the lease `heartbeatAt` (15-min TTL). Single-sourced via the WE drain; no daemon change.
