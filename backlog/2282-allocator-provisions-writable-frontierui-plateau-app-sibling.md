---
kind: decision
size: 3
parent: "2275"
status: active
dateOpened: "2026-07-06"
dateStarted: "2026-07-09"
tags: []
---

# Allocator provisions writable frontierui + plateau-app sibling clones for consumer leases

Foundational slice of #2275 for the drain migration. Extend the ensureFuiSibling pattern (we:scripts/lane-pool.mjs:165-199) into a general sibling-clone provisioner: real, PUSHABLE clones of the other constellation repos (frontierui, plateau-app) at the pool root — not the render-only frontierui symlink it provisions today (and no plateau-app at all). A leased lane's ../frontierui / ../plateau-app (what we:scripts/merge-ai-prs.mjs:468-474 siblingCloneDir resolves) must be valid rebase-drop targets for the drain's cross-repo tips. Independently unit-testable; harmless if unused until the migration lands. Without it, migrating the drain onto a leased lane would regress cross-repo rebase-drop.

## Pre-flight note (2026-07-07, deferred — needs a design call)

Skimmed while batching #2264's cluster. There's a **reverse-regression seam the split-analysis didn't fully resolve**: the pool-root `frontierui` is TODAY a **render-only symlink** to the primary FUI checkout's *built* tree (`we:scripts/lane-pool.mjs` `ensureFuiSibling`, #2166), and **every solo/batch WE lane's `build:docs`/`eleventy` reads that built artifact via `../frontierui`**. Replacing that symlink with a **real pushable clone at the same path** (which this item's body directs — "not the render-only symlink") gives an **unbuilt** FUI tree, so `build:docs` in any solo lane HARD-FAILS ("pinned FUI artifact missing") unless the provisioner **also runs FUI's `build:tools`** after cloning — the exact per-clone build cost #2166 chose the symlink to avoid.

**Fork before coding (get a human call):** (a) provision a real clone AND build it (one `build:tools` at pool root, kept fresh on refresh — serves both render + push); or (b) keep the render symlink and provision the **pushable** clones at a **separate** path, teaching `we:scripts/merge-ai-prs.mjs` siblingCloneDir to resolve there (but `siblingCloneName` currently hardcodes `../<name>`, so this needs a resolution change too). (a) is simpler/one-path but pays a build; (b) preserves #2166 but forks the path. Do **not** just swap the symlink for a bare clone — that silently breaks solo-lane render.

## Decision grounding (2026-07-09, decision session)

Two findings from grounding the fork against the code collapse (a)'s supposed costs:

1. **The `build:tools` cost #2166 feared is ~1.2s.** Timed live: `node fui:scripts/build-tools.mjs` → `real 0m1.161s`. #2166 chose the symlink to avoid *N per-lane* builds; option (a) is **one** build at pool-root, shared by all lanes. 1.2s on refresh is noise.
2. **No render/drain race on a shared clone.** Rebase-drop is pure git plumbing — merge-tree → commit-tree → push, explicitly **NO checkout** (`we:scripts/merge-ai-prs.mjs:43-44`). It mutates only git objects/refs, never the working tree or `dist/`. So render (reads `../frontierui/dist/`) and the drain (writes refs) touch disjoint filesystem regions — safe to share one clone.

`siblingCloneDir` (`we:scripts/merge-ai-prs.mjs:647-652`) hardcodes `resolve(cwd,'..',name)`, so the push clones **must** sit at pool-root `../frontierui` / `../plateau-app` — the exact path today's render symlink occupies. Collision is on `frontierui` only; `plateau-app` has no sibling today (greenfield either way).

**Recommendation: (a)** — one real, built clone at `../frontierui` + `../plateau-app`; drop the symlink special-case. Strictly less code (no second path convention across two files), and render becomes deterministic against a known ref instead of whatever happens to be built in primary.

**Red-team (the case for (b)):** (b)'s virtue is separation of concerns — a future *non-plumbing* drain op (a real `git checkout`/`reset` in rebase-drop) would race the render source on a shared clone. But that's hypothetical: #2198's design is committed to "no checkout, guard-safe." If it ever changes we split the path *then* — cheap, siblingCloneDir is one function. Adding (b)'s abstraction now to insure against a design we've committed against is premature; principle: **don't add an abstraction layer until a real requirement forces it.**

**Open (needs the human call): freshness ownership.** Under (a) the provisioner owns rebuilding FUI's `dist/` on refresh so render doesn't go stale against the clone's ref. Small addition to the refresh path — acceptable, or is the symlink's "always reflects my primary WIP" render behavior something relied on?

## Ruling (2026-07-09, ratified) — option (a)

**Provision one real, PUSHABLE clone per constellation repo at pool-root (`../frontierui`, `../plateau-app`) and build it; drop the render-only-symlink special-case.** The same clone serves both WE-lane render (its `dist/`) and the drain's cross-repo rebase-drop (fetch/merge-tree/commit-tree/push).

Decided against (b) (keep symlink + separate push path): its only genuine advantage — separating a mutable push clone from a stable render source — guards against a *future* non-plumbing drain op that #2198 is explicitly committed against ("no checkout, guard-safe"). Premature abstraction; split the path later (one function, `we:scripts/merge-ai-prs.mjs` `siblingCloneDir`) if that ever changes.

**Freshness ownership resolved:** the provisioner owns running FUI `build:tools` (~1.2s) on clone/refresh. Accepted tradeoff — WE-lane render now tracks the clone's committed ref (main), **not** uncommitted primary-FUI WIP. The one behavior removed by dropping the symlink is "lane render reflects my in-flight primary FUI edits"; ratified as not relied upon.

**Implementation notes for the build:** generalize `ensureFuiSibling` (`we:scripts/lane-pool.mjs:172-208`) into a per-repo sibling-clone provisioner over the constellation repos; clone (or fetch/reset) to main + run each repo's `build:tools` where it has one (FUI does; plateau-app has none — a plain clone un-breaks the lane's Vite dev-panel import too); keep idempotent on refresh. No change needed to `siblingCloneName`/`siblingCloneDir` — they already resolve `../<name>` at pool-root.
