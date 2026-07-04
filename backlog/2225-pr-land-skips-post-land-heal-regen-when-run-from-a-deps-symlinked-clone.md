---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-04"
dateResolved: "2026-07-04"
relatedTo: ["2182", "2071", "2123", "2200"]
tags: [pr-flow, pr-land, land, regen, self-heal, footgun, lane]
---

# `pr-land` silently skips post-land heal + regen when run from a deps-symlinked lane clone

Observed live 2026-07-03 landing **PR #87** from a dedicated scratchpad clone (the #2123 solo-lane path,
where the clone gets a symlinked `we:node_modules` + sibling `frontierui` so the gate can run). Both
post-land steps in `we:scripts/pr-land.mjs` were **skipped**:

- `runHeal()` (#2071 id-collision heal) and `runRegen()` (#2182 derived-artifact regen) each begin with a
  `git status --porcelain` dirty-probe and bail if the tree is non-empty.
- In a deps-symlinked clone the tree is **never** empty — the untracked `node_modules` symlink alone reads
  as dirty — so both steps skip **every** land from such a clone, not just genuinely-dirty ones.

For #87 the skip was harmless (verified: no id collision, no derived-artifact drift). But for a change that
**does** shift `gen:inventory`/`gen:reference-index` output, or that **collides** on an id at land, `main`
would be left with stale derived artifacts / an unhealed collision — silently, because the skip only prints
a `⚠` note the operator may not act on.

**Already fixed in this change (the acute bug):** the skip-path returns crashed `pr-land` *after* a
successful merge — `runRegen()`'s dirty/sync-fail returns lacked `done`/`failed`, so the summary line's
`regen.done.length` threw `Cannot read properties of undefined`. Patched to return `{ done: [], failed: [],
warning }`. The land still succeeded (merge happens before the crash), but the crash masked the skip and
aborted the summary.

**The gap to close (this item):** the dirty-probe is too coarse for the now-default solo-lane path.

- Both `runHeal`/`runRegen` already `git checkout --detach ${REMOTE}/${BASE}` and operate against
  **post-merge origin/main**, not the local working tree — so the local dirty state is irrelevant to their
  *correctness*; the dirty-probe is pure caution. **Recommended:** narrow the probe to ignore known-safe
  untracked entries (`node_modules`, and anything git-ignored) — e.g. `git status --porcelain
  --untracked-files=no` plus an explicit `node_modules` exclusion — so a deps-symlinked clone no longer
  reads as dirty and the steps run.
- Secondary hardening (cheap, do alongside): when heal/regen genuinely **are** skipped, make the land
  summary say so loudly (a `skipped: [...]` field / non-silent stderr banner), so a real skip can't read as
  "did everything."

The drain (`we:scripts/merge-ai-prs.mjs`) runs from a clean clone and doesn't hit this; the exposure is the
solo `/pr` land from a deps-symlinked clone, which #2123 made the default. Relates to #2200 (resume/land),
#2182 (regen), #2071 (heal).
