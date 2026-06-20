---
kind: story
size: 8
parent: "1143"
status: resolved
blockedBy: ["1144", "1145"]
dateOpened: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Workflow-driven /batch --parallel: effects-manifest + serial integrator

Wire the opt-in /batch --parallel onto the Workflow tool. The main loop keeps the conversational pack/plan/one-go and the close-out/calibration; Workflow runs only the execute phase and returns a ledger. The keystone safety move: lane agents never splice shared registries — they return a registry-effects manifest that one serial integrator applies after merge.

Shape: per-item effect-probe -> partition on the UNION of predicted touch-sets (frontmatter is a lower bound) -> orchestrator reserves+claims the whole pack in one context (kills the `we:.claude/skills/batch-backlog-items/reservations.json` race) -> `parallel()` lane agents in `isolation:worktree` that touch ONLY their own code + their own `we:backlog/NNN.md` and RETURN a registry-effects manifest, running the per-lane LOCAL gate (#1144) -> barrier -> a serial integrator agent applies each manifest one at a time, runs the FULL gate per merge, and replays a lane serially on conflict/red. `budget.remaining()` = the points budget (sole stop). Reliability-first barrier (parallel-all then serial-integrate); streaming integrate is a later optimization.

## Progress

Artifact delivered + structurally verified. **Live validation deferred to a real multi-lane run** (see follow-up).

- **Orchestrator script:** `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` — a `Workflow` body (invoked by the skill as `Workflow({scriptPath, args})`). Implements: per-item effect-probe (parallel, low-effort) -> pure-JS greedy partition into a serial fallback lane + provably-disjoint parallel lanes -> `parallel()` lane agents in `isolation:'worktree'` gating locally via `check:standards --local --files=…` (#1144) -> serial integrate loop (merge one at a time, full gate per merge, replay conflicted/red lane serially — the single-threaded JS loop is the merge mutex) -> regenerate derived artifacts ONCE -> return a ledger. Three JSON-Schema contracts (probe / lane-result / integrate).
- **Skill wiring:** `we:.claude/skills/batch-backlog-items/SKILL.md` "Parallel lanes" now points `--parallel`'s execute phase at the script; the main loop keeps the conversational pack/plan/"go" + close-out.
- **The #1145/#1146 split shrank the integrator:** per-entry registries mean a lane adding a registry entry writes its OWN file (disjoint, merges clean) — so the effects-manifest is NARROW: only derived artifacts (`we:AGENTS.md`, `we:src/_data/referenceIndex.json`, regenerated once) + rare monolithic-registry edits (projects/capabilities/adapters/capabilityMatrix/designSystems), applied serially by the integrator.

**Verification done (what's possible without a live run):** the script parses + builds as an async Workflow body with the injected globals; schemas are valid; sandbox-safe (no fs / `child_process` / `Date` / `Math.random` — all side effects are inside agents via Bash). **Not done:** an actual `--parallel` batch spanning independent subsystems (spins up worktrees, real concurrent agents). Carved to a follow-up so epic #1143 stays open until parallel batching is proven live.
