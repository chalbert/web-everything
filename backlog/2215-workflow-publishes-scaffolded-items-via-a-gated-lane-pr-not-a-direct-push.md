---
kind: story
size: 3
relatedTo: ["2203", "2183"]
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-04"
dateResolved: "2026-07-04"
tags: [lane, pr-flow, workflow, drain, git]
---

# The `/workflow` publishes its scaffolded items via a gated lane→PR, not a direct push to `main`

The parallel `/workflow` model dispatches lanes that clone `origin/main` and **claim items that already exist
there** — so new items must reach `main` *before* the lanes run. Today that publish step was done as a
`we:scripts/backlog.mjs` scaffold in the primary + a **direct `git push`** to `main`, which skips CI and landed
an ungated error (the incident behind #2203). Under the #2203 ruling the direct push is now blocked
(`we:scripts/guard-bash.mjs`), so this setup step must be re-routed or it stalls the run.

**Fix — pick one (the second is cleaner):**
1. **Gated pre-publish:** the orchestrator scaffolds the batch's new items in a **lane clone**, opens a
   ready-to-merge PR, waits for it to land (CI-gated), *then* dispatches the parallel lanes. One extra PR-cycle
   of latency before a run, but every item is gated before a lane claims it.
2. **Scaffold in-lane (preferred):** each lane scaffolds its **own** item (or the orchestrator seeds the item
   body to the lane), which then rides that lane's own PR — no pre-publish to `main` at all. NNN collisions
   across lanes are healed at land time by the existing `pr-land` id-collision heal (#2071). This removes the
   *last* legitimate primary-write, making the #2203 "primary is read-only" lock clean end-to-end.

Update `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` (and the batch skill's setup
guidance) accordingly. Relates to #2203 (the ruling that requires it) and #2183 (the PR-fan-out model).
