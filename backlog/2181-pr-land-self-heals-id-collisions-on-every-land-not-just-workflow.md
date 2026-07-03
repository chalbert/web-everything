---
kind: task
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
relatedTo: ["2071", "2138", "2153", "2162", "2123"]
tags: [pr-flow, land, self-heal, backlog-ids, merge-queue, dx]
---

# pr-land self-heals new-item id collisions on every land — not just the batch workflow

The #2071 "newer yields" backlog id-collision heal lived ONLY inside the parallel integrator
(`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`, Phase 4b-collision). Every OTHER land
route — `we:scripts/pr-land.mjs` (the #2153 self-approved-PR transport used by `/pr`), `we:scripts/lane-drain.mjs`
(which reuses pr-land), and a manual `gh pr merge` — did **not** self-heal. Per the #2123 ruling (every edit
runs the same isolated-lane flow) the land half should be uniform too: a lane's newly-created backlog item
can collide on `#NNN` with an item another lane landed concurrently, and the collision only surfaces AFTER
both are on `main` (as `ids must be unique` at the gate + an 11ty output conflict). This bit a real manual
land (PR #12, `#2170` twice) which had to be renumbered by hand.

**Change.** `we:scripts/pr-land.mjs` now runs the heal after a clean merge (`--no-heal` opts out): sync to
POST-MERGE `main` (detached — never resetting a branch, so an accidental `--repo=<primary-with-work>` is
safe), run the sanctioned `we:scripts/backlog-renumber-collisions.mjs --json` with **no `--base-ref`** (on
post-merge main any duplicate `NNN` is a genuine allocation collision and the just-merged / highest
git-ordinal file yields — a base guard would wrongly skip it), and if it renumbered, full-gate the healed tree
then commit + push the fix (never force-pushed). A heal problem is surfaced but **never fails the land** — the
merge already succeeded; worst case is a loudly-reported residual, exactly as the batch integrator behaves.

**Scope (deliberate).** Only the universal *per-land* step is shared. The batch-only integrator steps
(multi-lane-file scan, reconcile/stranded, reopen-unlanded, base-ref cleanup, gated publish) stay in the
workflow — they need a pre-claimed batch set and have no meaning for a single land. Derived-artifact regen is
the natural next fold (same shape) and is left as a fast-follow. **The workflow is unchanged** — it keeps its
own inline heal; pr-land simply stops being the only place the heal lives.

**Delivered:** `we:scripts/pr-land.mjs` (`--heal` default-on, `buildRenumberHealArgs()`, `runHeal()`);
`we:scripts/__tests__/pr-land.test.mjs` (pure-arg + source-contract coverage). Dogfooded: this item landed via
the updated pr-land.
