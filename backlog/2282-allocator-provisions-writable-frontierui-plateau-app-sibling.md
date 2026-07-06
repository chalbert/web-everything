---
kind: story
size: 3
parent: "2275"
status: open
dateOpened: "2026-07-06"
tags: []
---

# Allocator provisions writable frontierui + plateau-app sibling clones for consumer leases

Foundational slice of #2275 for the drain migration. Extend the ensureFuiSibling pattern (we:scripts/lane-pool.mjs:165-199) into a general sibling-clone provisioner: real, PUSHABLE clones of the other constellation repos (frontierui, plateau-app) at the pool root — not the render-only frontierui symlink it provisions today (and no plateau-app at all). A leased lane's ../frontierui / ../plateau-app (what we:scripts/merge-ai-prs.mjs:468-474 siblingCloneDir resolves) must be valid rebase-drop targets for the drain's cross-repo tips. Independently unit-testable; harmless if unused until the migration lands. Without it, migrating the drain onto a leased lane would regress cross-repo rebase-drop.
