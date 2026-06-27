---
kind: decision
parent: "1855"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
codifiedIn: "docs/agent/backlog-workflow.md#two-modes-explicit-selection"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-workflow-vs-serial-batch-orchestration.md
tags: [agent-orchestration, batch, workflow, structured-output, native-first]
---

# Does the Workflow orchestrator supersede serial batch-backlog-items?

**No — they are not competing tools; they are two execute modes of one skill.** The card's premise is false: `/workflow` *is* the `batch-backlog-items` skill in `--parallel` execute mode, `/batch` is the same skill serial, and the parallel orchestrator already degenerates to serial when no disjoint lane exists. So "supersede?" is a confirmation, not a fork. One genuine fork remains — the **routing/entry model** (explicit selection vs. auto-route) — while the card's downstream **structured-output** note dissolves (schema is already adopted across the lanes). Front-B currency call for the model-usage watch ([#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/)).

## The axis — what is genuinely open, grounded in the shipped tooling

The single mechanism already exists and is coherent. `/batch` + `/batch-next` run the serial inline loop (the default execute model); `/workflow` runs the parallel orchestrator on the `Workflow` tool; `--parallel`/`--serial` override either command per-invocation ([we:.claude/skills/batch-backlog-items/SKILL.md:13-19](.claude/skills/batch-backlog-items/SKILL.md#L13-L19), [we:.claude/commands/workflow.md](.claude/commands/workflow.md)). The orchestrator's safety contract — serial is the safe baseline, partition only on provable touch-set independence, git is the conflict detector, degenerate to serial otherwise — is codified in [we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:1-30](.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L1-L30) and was delivered under [#1143](/backlog/1143-safe-parallel-batching-via-workflow-orchestration/)/[#1147](/backlog/1147-workflow-driven-batch-parallel-effects-manifest-serial-integ/). The two modes differ on a real, documented cost axis: serial `/batch` **calibrates** a context-%→points budget, while parallel `/workflow` **skips calibration** because its points resolve in worktree subagent contexts decoupled from the orchestrator's context — its ceiling is the token/agent budget ([we:docs/agent/backlog-workflow.md:648](docs/agent/backlog-workflow.md#L648), throughput order at [we:docs/agent/backlog-workflow.md:558](docs/agent/backlog-workflow.md#L558)). The card's option (b) "fold everything into always-parallel" is the *broken* branch: coupled clusters can't be safely parallelized, and the orchestrator already routes them serial — forcing parallel adds probe + worktree overhead with zero benefit. Two residuals are genuinely open: **(1)** whether the operator keeps choosing the mode explicitly or a single entry auto-routes; and **(2)** where (if anywhere) to adopt the `Workflow` tool's `agent({schema})` provider-enforced structured output — noting the readiness ranker [we:scripts/check-readiness.mjs:1-12](scripts/check-readiness.mjs#L1-L12) is *deliberately LLM-free*.

## Recommended path at a glance

| Concern | Shape | Recommended | Why |
|---|---|---|---|
| **Title — "does Workflow supersede serial?"** | confirmation | **No — one skill, two modes** | `/workflow` *is* `batch-backlog-items --parallel`; serial default + parallel opt-in already shipped (#1143/#1147). |
| **Fork 1 — routing / entry model** | genuine fork | **(a) keep explicit selection** *(operator's call, 2026-06-27 — flips prepared (b))* | Keep both entries; operator picks `/batch` (serial) vs `/workflow` (parallel), `--serial`/`--parallel` as overrides. No code change; orchestrator already degenerates to serial. Avoids paying probe + worktree overhead on every batch, and the calibration boundary is per-command-clear rather than prose-gated. |
| **Structured-output (`agent({schema})`)** | supported by default | **already adopted; ranker stays deterministic (invariant)** | Schema is in use across the lanes today; the readiness ranker is deliberately LLM-free and must stay byte-identical to the rendered tab. |

## Fork 1 — routing / entry model: explicit selection vs. auto-route

*Fork exists:* both branches are coherent and mutually exclusive **as the default** — the execution shape is a *data-dependent scheduler decision* (which of today's packed items happen to be disjoint), so freezing it into the choice of slash-command vs. recomputing it per run is a real either/or, not a forced invariant.

- **(a) Keep explicit mode selection.** The operator picks `/batch` (serial) vs `/workflow` (parallel), `--parallel`/`--serial` overriding either. Preserves the *two execution paths*: inline-serial (calibrated, context-bounded, Sonnet-delegable) and orchestrator-parallel (worktree subagents, token-bounded, no calibration). Its weakness (per the skeptic): the operator can't reliably predict disjointness — that's *why* the probe exists and treats declared files as a lower bound — so the explicit choice mostly controls whether the probe runs at all, and the calibration-clean guarantee rides on prose discipline, not code.
- **(b) Auto-routing single entry** *(default).* One entry **always runs the probe** and lets the existing deterministic partition decide serial-vs-parallel per item (it already does this — [we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:186](.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L186) probes at `effort:'low'`; degenerates to serial when nothing is disjoint). Make the calibration-skip a **code-gated consequence of "did any lane run concurrently"** rather than a function of which command was typed (the `calibrate()` fit is mode-blind today — [we:scripts/backlog.mjs:369](scripts/backlog.mjs#L369) — so the clean-estimate guarantee is currently prose-only). Retain `--serial`/`--parallel` purely as manual overrides for the probe's known blind spots (a shared `.njk` include it misses) or a budget-constrained run. Field tools (CrewAI `Process.sequential`/`hierarchical`, LangGraph state-graph) make process-type explicit because the *author encodes a known graph* — here it's a per-run scheduler decision, so the analogy argues for auto-routing, not against it.

*Surviving tension for the decider (the skeptic underweighted this):* unifying on one auto-routing entry means **every** batch flows through the `Workflow` orchestrator — so even a degenerate-serial run pays probe + integration-worktree overhead and loses the inline-serial path's calibrated, context-bounded, Sonnet-delegable execution. The real call is *"keep two execution paths with explicit selection"* vs *"unify on the orchestrator and always probe."* The prepared default leaned (b) because the probe is cheap and can never make a clean batch slower than serial — but this tension is exactly what the operator weighed.

**Resolution (operator, 2026-06-27): (a) keep explicit selection.** Both entries stay; the operator chooses `/batch` vs `/workflow` per run, with `--serial`/`--parallel` as overrides. Rationale: (a) preserves both execution paths and avoids paying probe + integration-worktree overhead on degenerate-serial runs; the inline-serial path keeps its calibrated, context-bounded, Sonnet-delegable execution. Red-team of (a) failed to land: the "operator can't predict disjointness" knock is moot because explicit selection keeps the probe as an opt-in escape hatch (`/workflow` still probes + degenerates to serial), and the prose-gated-calibration risk was specific to the *unified* world — under explicit selection each command has one defined calibration behavior, so the boundary is per-command-clear, not prose-enforced. (a) aligns with most-flexible-default and bias-toward-separation; no catalog principle is violated. The prepared (b) lineage is retained below as the considered-and-rejected alternative.

Code surface (the default's shape):

```text
/batch [P] [NNN]   → always probe → deterministic partition picks serial|parallel per item
                     calibration runs IFF no lane ran concurrent (code-gated, not prose)
--serial           → manual override: skip the probe, force inline serial
--parallel         → manual override: force the orchestrator path
```

*Skeptic: REFUTED → default flipped from "(a) keep explicit" to "(b) auto-route." Verified against code: the probe already makes the serial/parallel call at item granularity, and `calibrate()` is mode-blind ([we:scripts/backlog.mjs:369](scripts/backlog.mjs#L369)) so today's clean-estimate guarantee is prose-enforced, not code-enforced — both load-bearing for the flip. Amendment folded: retain `--serial`/`--parallel` as overrides; surfaced the path-unification cost the skeptic glossed as the residual.*

## Supported by default (not a fork) — structured-output (`agent({schema})`)

The card's downstream note ("adopting `agent({schema})` for readiness ranking and decision-fork parsing") dissolves on inspection — it is not an open fork:

- **Already adopted across the lanes.** The orchestrator already uses `agent({schema})` for its probe (`PROBE_SCHEMA`), item-result, integrate and replay stages ([we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:71](.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L71), [:186](.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L186), [:259](.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L259)). The compounding chain the 0.95^N reliability argument describes is the **probe→partition** step (a missed file corrupts a merge) — and it is *already* schema-validated. There is no new "fork-parsing handoff" to adopt: fork pre-flight is a **main-loop conversational judgment** step (the skill's `meta` block + [we:.claude/skills/batch-backlog-items/SKILL.md:52](.claude/skills/batch-backlog-items/SKILL.md#L52)), deliberately reserved as human judgment, not a lane handoff — schematizing it would convert a judgment call into structured extraction.
- **Ranker determinism is an invariant, not a tuning choice.** [we:scripts/check-readiness.mjs:1-12](scripts/check-readiness.mjs#L1-L12) is a pure deterministic projection of loader fields, byte-identical to the rendered Prioritisation tab. Routing it through an LLM doesn't merely "regress" it — it breaks CLI/tab parity and injects nondeterminism into the one component the whole batch loop trusts to be reproducible. **Keep it LLM-free, full stop.**

Net: no adoption decision remains; the only live follow-on is *confirming/strengthening `PROBE_SCHEMA` validation*, which is a hardening task, not a fork — file it as a child of #1855 if the decider wants it tracked.

*Skeptic: SURVIVES-WITH-AMENDMENT → demoted from a `## Fork` to "supported by default." Verified: schema is already adopted across the lanes and fork pre-flight is main-loop judgment, so the named target was mis-located; the ranker-exclusion is hardened to a determinism/tab-parity invariant.*

## Lineage

Opened 2026-06-27 under the model-usage watch [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/) as a front-B currency call (sweep harness primitives, adopt what's worth it). Prepared 2026-06-27: prior-art survey + the shipped-tooling grounding correcting the card's premise, published as research topic `workflow-vs-serial-batch-orchestration` and report [we:reports/2026-06-27-workflow-vs-serial-batch-orchestration.md](reports/2026-06-27-workflow-vs-serial-batch-orchestration.md). The parallel orchestrator itself shipped under [#1143](/backlog/1143-safe-parallel-batching-via-workflow-orchestration/)/[#1147](/backlog/1147-workflow-driven-batch-parallel-effects-manifest-serial-integ/).
