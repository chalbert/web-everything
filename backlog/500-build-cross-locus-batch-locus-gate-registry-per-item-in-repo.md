---
type: idea
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
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

> **Split analysis ([2026-06-13](../reports/2026-06-13-backlog-split-analysis.md)): could-not-split.** The
> four spec parts enforce one safety invariant (`packable ⟺ honestly-gateable-in-its-locus`); the natural
> packing‖gating seam is unsafe (packing without gating resolves cross-repo work on the WE gate), and the
> safe order is a rigid setup chain with value only at the end. Built as one coherent pass instead.

## Built (2026-06-13)

All five spec points landed in one pass:

1. **Registry** — `LOCI` in [check-standards-rules.mjs](../scripts/check-standards-rules.mjs) is now a
   record map `{repoPath, gateCommand, devServerProbe, commitTarget, closeoutDiscipline?}` (was a `Set`);
   validation switched to `Object.hasOwn`/`Object.keys`.
2. **Cross-locus packing** — `computeBatchPack` ([engine.mjs](../scripts/readiness/engine.mjs)) dropped the
   single-locus filter + `otherLocus` bucket + `batchLocus` param; packs every locus together. CLI
   ([check-readiness.mjs](../scripts/check-readiness.mjs)) dropped `--locus`/"Other locus", flags each
   cross-repo item `⌂ <locus>` and prints a per-locus gate legend. Verified: #425/#449 (frontierui) +
   #335 (plateau-app) now pack alongside WE items.
3. **Per-item in-locus gating + per-repo commit** — documented in
   [backlog-workflow.md](../docs/agent/backlog-workflow.md) *Repo-locus* (rewritten from "future
   capability" to BUILT) + the batch loop step 2, and [batch SKILL.md](../.claude/skills/batch-backlog-items/SKILL.md).
4. **exercise-app `closeoutDiscipline`** — `check:standards && check:app-conformance` gate + non-skippable
   GAP-tagging, in its `LOCI` entry + the doc.
5. **Doc** — *Repo-locus* rewritten; `out-of-locus` removed as a drop-reason (folds into `blocked-in-fact`
   only when a locus repo isn't checked out).

Tests: `engine.test.mjs` repo-locus block rewritten to assert locus-agnostic packing (40 vitest green);
`check:standards` 0 errors.
