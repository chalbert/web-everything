---
kind: story
size: 8
parent: "1933"
status: open
blockedBy: ["1942"]
dateOpened: "2026-06-28"
tags: []
---

# Slice 4: cross-repo lanes — provision frontierui/plateau-app lane pools for constellation items

Extend the #1933 orchestrator (slice 3, #1942) to items whose impl spans the constellation (WE -> frontierui -> plateau-app). A single item often touches multiple repos, so a lane needs a clone of EACH affected repo, not just WE. we:scripts/lane-pool.mjs (slice 2) is already repo-parameterized (--repo/--origin/--reference/--name), so this slice wires the orchestrator to: detect an item's affected repos, provision a lane pool per repo, dispatch the agent across the coupled clones, and push + integrate each repo's lane/* independently. Slice 3 v1 may scope WE-only to ship sooner; this lifts that. Hard part: cross-repo atomicity — one logical change landing in two repos is two merges, so define the ordering/rollback story.
