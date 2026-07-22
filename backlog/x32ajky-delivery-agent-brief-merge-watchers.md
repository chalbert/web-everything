---
kind: story
size: 3
parent: "xkggoo0"
status: open
dateOpened: "2026-07-22"
tags: [conveyor, agent]
---

# Delivery-agent brief + merge watchers

The reusable delivery-subagent prompt template the conveyor (#xkggoo0) spawns per launch entry, plus the per-PR merge watcher that gives the main session instant merge notification without a push seam. The brief walks the normal verbs only — so lane-board state stays free (the epic's no-parallel-state-store ruling) — and the agent stops at ready-to-merge: the resident drain daemon is the single landing serializer.

## The brief (prompt template)

claim → lane-pool clone → build → gate green → push the lane branch → PR + `ready-to-merge` label only after the required `test` check is green → append a structured learnings entry to the session drop-box (#xzabmtp) → **exit WITHOUT merging** (the drain daemon lands it).

## The watcher

A throwaway background process per in-flight PR: poll `gh pr view --json state` about every 20s, **exit on merged/parked** — the exit rides the task-notification wake path, so the exit IS the main session's wake signal, and the conveyor dispatches into the freed lane the same turn.

**Upgrade path:** replace the gh-poll watcher with the blocking `watch --pr N` verb on plateau:tools/drain-daemon/cli.mjs once #2605 (the daemon's nudge/SSE push seam) lands. #2605 is a consumer upgrade, not a blocker.
