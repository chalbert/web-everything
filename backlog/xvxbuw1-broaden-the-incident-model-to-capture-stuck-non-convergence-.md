---
kind: task
parent: "2445"
status: open
dateOpened: "2026-07-14"
tags: []
---

# Broaden the incident model to capture stuck / non-convergence, not just restart/lease-loss

The incident timeline (shipped by the resolved #2473) classifies journal passes into restart-recovery, lease-loss, drain-fail, and dup-nnn incidents. But it has no class for a SILENT non-convergence: a loop that makes no progress despite ready work. The actual 2026-07-13 failure logged no incident at all. Add a "stuck / non-convergence" incident class — e.g. the queue made no progress for N passes despite ready work, or a PR's head SHA churned more than K times — so the thing that actually went wrong becomes a first-class incident on the timeline instead of an invisible gap.

## Grounding

On 2026-07-13/14 the daemon deadlocked for 70+ minutes in a batch-landing loop (plateau #477): heads churned, `merged` stayed flat while ready PRs sat. `deriveIncidents` (in `plateau:tools/drain-daemon/lib.mjs`) classified every pass as normal — none of its existing classes match "stuck but not crashing," so the timeline recorded nothing. The incident model captures failures that throw or lose a lease, but not the one that just stops converging.

## Scope

Extend `deriveIncidents` with a stuck/non-convergence class: no `merged` progress for N passes while ready-count > 0, or a PR head SHA churning > K times. Derived from the existing journal (`plateau:.drain-daemon/history.jsonl` + `plateau:.drain-daemon/state.json`) — no daemon change. Pairs with the anomaly-detection story so a stuck loop both alerts live AND lands a durable incident record. Impl lives in plateau-app; WE holds zero impl (this card is the tracker).
