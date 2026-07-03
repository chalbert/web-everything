---
kind: story
size: 5
status: resolved
blockedBy: ["2183", "2189"]
relatedTo: ["2162", "2173", "2138", "2161"]
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [drain, merge, pr-flow, label, convergence]
---

# Converge /merge and the drain on the ready-to-merge label (one lander)

Spin-off (d) of #2183, the **F1=label** consequence. Once `/workflow` (#2189) opens `ready-to-merge`-labelled
PRs, the two landers should become one: `we:scripts/merge-ai-prs.mjs` (`/merge`, sweeps green + mergeable +
AI PRs) and `we:scripts/lane-drain.mjs` (`/drain`, lands queued couples in blockedBy order) both land
PRs — they should converge on the **label** as the single discovery signal.

## The change

- **Discover by label, not by `we:queued.json`.** Today the drain enumerates the main-committed
  `we:queued.json` token to find couples. Under #2183, the producer no longer writes that token to `main`
  (zero commits to main); the ready-to-merge signal is the **PR label**. Teach the lander to list **open PRs
  carrying `ready-to-merge`**, read each WE PR's `we:.lane-manifest.json` off the PR head ref (the drain
  already reads manifests off refs), and land in cross-item `blockedBy` order — impl-first/WE-last per couple.
- **One lander.** Fold `/merge`'s "sweep any green AI PR" and `/drain`'s "ordered couple landing" into a
  single label-scoped lander: the label bounds the set, the manifest supplies the order, `we:scripts/pr-land.mjs`
  is the transport (already shared). `/merge` keeps its orphan-PR sweep for un-manifested labelled PRs.

## Acceptance

- Running the drain with **no `we:queued.json`** discovers and lands the ready-to-merge-labelled PRs in
  blockedBy order.
- `/merge` and `/drain` share one code path scoped by the label; a labelled PR is landed exactly once.
- The label is cleared / PR merged as the single clear point (replacing the #2161 unqueue).
