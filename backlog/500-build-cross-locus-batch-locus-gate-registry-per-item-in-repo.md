---
type: idea
workItem: story
size: 8
status: open
dateOpened: "2026-06-13"
tags: []
---

# Build cross-locus batch — locus→gate registry + per-item in-repo gating (per #498)

Implement the [#498](498-cross-locus-batch-via-a-per-item-locus-gate-registry/) ruling: make `/batch`
locus-agnostic so a single session can claim and close **any** of the ~44 batchable items across all
four loci (webeverything, frontierui, plateau-app, exercise-app), gating each in its own locus. This
lifts the single-locus wall that today drops ~32 of 44 batchable items as out-of-locus.

## Spec (ratified — #498 Ruling)

1. **Declarative per-locus registry** — `{ repoPath, gateCommand, devServerProbe, commitTarget,
   closeoutDiscipline? }` extending the `LOCI` set (`check-standards-rules.mjs`). Config, not loop logic.
2. **Cross-locus packing** — readiness stops filtering the pack to `BATCH_LOCUS`
   ([scripts/readiness/engine.mjs:212-213](../scripts/readiness/engine.mjs#L212-L213),
   [scripts/check-readiness.mjs:70-93](../scripts/check-readiness.mjs#L70-L93)); the `Other locus`
   section collapses (every batchable item is now packable). Keep the soft-reservation logic.
3. **Per-item in-locus gating (Fork 2 fixed mechanic)** — after each item the loop runs that locus's
   `gateCommand` in its `repoPath`, **green-at-every-seam preserved**; commits per-repo (never
   `git add -A` across repos); `devServerProbe` detects-or-skips a running server, never spins/kills one
   ([don't-kill-dev-server]).
4. **exercise-app via `closeoutDiscipline` (Fork 4)** — its gate is `check:standards +
   check:app-conformance` (both webeverything scripts); the `/exercise-app` GAP-tagging rule
   (platform-first build, else tag a GAP) is a **required, non-skippable** close-out step.
5. **Doc** — rewrite the `Repo-locus` section of [docs/agent/backlog-workflow.md](../docs/agent/backlog-workflow.md)
   to describe the registry (it currently codifies the single-locus wall).

**Recommended `/split`** (likely > 8 as one piece): (A) registry config + cross-locus packing; (B) the
batch-loop per-item in-locus gating + per-repo commit; (C) exercise-app `closeoutDiscipline` enforcement.
Decision #498 is resolved, so all three are unblocked once carved.
