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

## Pre-flight note (2026-07-07, deferred — needs a design call)

Skimmed while batching #2264's cluster. There's a **reverse-regression seam the split-analysis didn't fully resolve**: the pool-root `frontierui` is TODAY a **render-only symlink** to the primary FUI checkout's *built* tree (`we:scripts/lane-pool.mjs` `ensureFuiSibling`, #2166), and **every solo/batch WE lane's `build:docs`/`eleventy` reads that built artifact via `../frontierui`**. Replacing that symlink with a **real pushable clone at the same path** (which this item's body directs — "not the render-only symlink") gives an **unbuilt** FUI tree, so `build:docs` in any solo lane HARD-FAILS ("pinned FUI artifact missing") unless the provisioner **also runs FUI's `build:tools`** after cloning — the exact per-clone build cost #2166 chose the symlink to avoid.

**Fork before coding (get a human call):** (a) provision a real clone AND build it (one `build:tools` at pool root, kept fresh on refresh — serves both render + push); or (b) keep the render symlink and provision the **pushable** clones at a **separate** path, teaching `we:scripts/merge-ai-prs.mjs` siblingCloneDir to resolve there (but `siblingCloneName` currently hardcodes `../<name>`, so this needs a resolution change too). (a) is simpler/one-path but pays a build; (b) preserves #2166 but forks the path. Do **not** just swap the symlink for a bare clone — that silently breaks solo-lane render.
