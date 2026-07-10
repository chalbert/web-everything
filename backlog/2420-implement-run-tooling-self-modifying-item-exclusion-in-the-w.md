---
bornAs: x34749p
kind: story
size: 5
status: resolved
blockedBy: []
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: none
tags: []
---

# Implement RUN_TOOLING self-modifying-item exclusion in the /workflow partition

Build arm of decision #2077. Add a declared RUN_TOOLING pathspec + isRunTooling()/selfModifying() to the canonical, unit-tested we:scripts/readiness/lane-partition.mjs (inline-mirrored in the workflow sandbox), matched against each probe's predicted touch-set at Phase 1 after probes and before the Phase-2 pre-claim, so a self-modifying item is dropped with nothing claimed. Scope = full run-tooling surface (skill dir + shelled scripts: we:scripts/backlog.mjs, we:scripts/lane-pool.mjs, we:scripts/readiness/*, we:scripts/push-if-green.mjs, we:scripts/backlog-renumber-collisions.mjs, we:scripts/dev/render-check.mjs); exclude batch state files and build config. Three detection seats: probe-time front door, post-hoc changedFiles check at integrate (carry refs, dont merge), serial-lane prompt stop-revert-report guard. Plus a coverage-parity unit test that walks TRANSITIVE shell-outs from the workflow source and asserts RUN_TOOLING covers them. Interim routing: drop from /workflow, work solo or LAST in serial /batch. Ruling codified under the pr-flow-rollout-mechanism statute.

## Resolution — SUPERSEDED (no code; 2026-07-10)

Resolved without building. The premise was overtaken by changes that landed **before** decision #2077 was ratified, and the surviving work is re-filed under a correctly-scoped successor (born-as `x492os3`).

- **The route-(a) apparatus this arm specifies no longer has anywhere to attach.** The `/workflow` orchestrator ([we:skills-src/batch-backlog-items/parallel-execute.workflow.js](../skills-src/batch-backlog-items/parallel-execute.workflow.js)) is the #2183 PR-fan-out model: **no probe→partition, no touch-set prediction, no Phase-2 pre-claim, no in-run integrate, no serial lane.** The three detection seats (probe front door, integrate post-hoc, serial-lane guard) target structures #2183 removed.
- **Decision #2077's (a)→(c) sunset already fired.** Both conditions are met — the #2153 PR drain is live (resolved) AND the in-run integrator + serial lane are retired, producers stop at lane-push (#2183/#2189 resolved). #2138/#2151/#2152/#2153/#2160 all resolved.
- **The hazard is structurally dissolved under (c).** Each item edits only its own lane clone; lanes shell out to scripts in their own clone; the producer never merges to primary mid-run. No in-run self-modification is possible.
- **The RUN_TOOLING vocabulary can't be built correctly in isolation.** The #2077 regex list is stale on two axes — #2266 moved the skill dir to `skills-src/` (so `.claude/skills/…` no longer matches git's canonical path), and #2183/#2153 changed the shell-out surface (now `pr-land`, `lane-manifest-write`, `lane-review`, `lane-drain`, `merge-ai-prs`, `lib/*` — none in the four regexes). Correct membership is defined by what the DRAIN actually shells out to, so it belongs with its consumer.
- **Surviving residual → successor `x492os3`.** The drain ([we:scripts/lane-drain.mjs](../scripts/lane-drain.mjs)) shells out to run-tooling (`push-if-green`, `readiness/*`, `pr-land`), so RUN_TOOLING-touching queued items must land LAST in a drain pass, and no serial/solo re-route may land a run-tooling change while a `/workflow` run is live. The successor owns the RUN_TOOLING vocabulary + coverage-parity drift test + drain-pass ordering as one coherent unit.
- **The ruling itself is durable regardless:** codified at [we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism](../docs/agent/platform-decisions.md) (the #2077 rider).
