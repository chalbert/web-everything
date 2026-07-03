---
kind: task
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
relatedTo: ["2181", "2160", "2138"]
tags: [pr-flow, land, self-heal, derived-artifacts, dx]
---

# Fold derived-artifact regen into pr-land as a post-land step (companion to the #2181 id-collision heal)

#2181 lifted the #2071 id-collision heal into `we:scripts/pr-land.mjs` so every land route self-heals. The
parallel integrator (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`, Phase 4c) runs a
SECOND universal post-merge step #2181 deliberately left out of scope: **regenerating WE derived artifacts
once** (the `we:AGENTS.md` inventory block, `we:src/_data/referenceIndex.json`,
`we:src/_data/capabilityWorkedExample.json`). Without it, a `/pr`- or manually-landed change whose inputs feed
a derived artifact leaves `main` with stale generated output — the exact local-green / CI-red divergence #2160
describes.

**Do:** add a post-merge regen to pr-land in the SAME shape as `runHeal` (#2181) — after a clean merge, run the
deterministic generators, and if anything changed, gate + commit + push the regenerated files (never
force-pushed); a regen problem is surfaced but never fails the land. Reuse the workflow's Phase-4c generator
list. Gate behind the same `--heal`/`--no-heal` toggle (or a sibling `--no-regen`). Add coverage to
`we:scripts/__tests__/pr-land.test.mjs`. Batch-only integrator steps (reconcile, reopen, multi-lane scan,
gated publish) stay workflow-only — this is the last *universal per-land* step still trapped in the workflow.
