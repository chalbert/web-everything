---
kind: story
size: 3
status: resolved
blockedBy: ["2282"]
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
tags: []
---

# Generalize ensureFuiSibling into a per-repo pushable+built sibling-clone provisioner

Ratified in #2282 (option a): replace the render-only frontierui symlink with real, PUSHABLE clones of each constellation repo (frontierui, plateau-app) at pool-root, and run each repo's build:tools (~1.2s for FUI) on clone/refresh so the one clone serves both WE-lane render (its dist/) and the drain's cross-repo rebase-drop. Generalize ensureFuiSibling (we:scripts/lane-pool.mjs); no change to siblingCloneName/siblingCloneDir (already resolve ../<name>). Idempotent on refresh; a plain plateau-app clone also un-breaks the lane Vite dev-panel import.
