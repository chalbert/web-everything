# Workflow orchestrator vs serial batch — they are one skill, not competitors

> Grounding report for decision [#1862](/backlog/1862-does-the-workflow-orchestrator-supersede-serial-batch-backlo/)
> ("Does the Workflow orchestrator supersede serial batch-backlog-items?"), a front-B currency call under
> the model-usage watch [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/).
> Survey + classification only — the ruling is `/next decision`'s job.

## TL;DR — the card's premise is false

The card frames a three-way fork — *keep both · fold batching into Workflow · serial-default-with-opt-in* —
on the premise that "a `/workflow` skill already exists for running backlog items in parallel disjoint lanes,
yet batch-backlog-items still runs serially." **That premise does not match the shipped code.** There is no
separate `/workflow` skill. `/workflow` is the **same** `batch-backlog-items` skill invoked in its
`--parallel` **execute mode**; `/batch` is the same skill in its serial execute mode. The relationship the
card asks us to decide is **already shipped and coherent**:

- One skill, two execute modes, **serial is the default**, parallel is **opt-in** (`/workflow` or `--parallel`).
- The conversational arc is **identical** across modes (pack → ordered plan → one "go" → reserve → close-out).
- With **no provably-disjoint pair**, the parallel orchestrator **degenerates to serial** — correct, not a failure.

So the literal question ("does Workflow *supersede* serial?") answers itself: **no — they are not competitors,
they are two modes of one skill.** That collapses two of the card's three options into the shipped reality and
leaves the third ("fold everything into always-parallel") as a *broken* branch. What remains worth ratifying is
narrower and genuinely open: the **entry/routing model** (keep explicit opt-in vs. auto-route) and the
**structured-output adoption** the card flagged as downstream.

## What actually shipped (concrete refs)

| Concern | Where it lives | Behaviour |
|---|---|---|
| `/batch`, `/batch-next` | `we:.claude/skills/batch-backlog-items/SKILL.md` (L15–19) | Serial inline loop — the **default** execute model. |
| `/workflow` | `we:.claude/commands/workflow.md` | Invokes the **same** skill in `--parallel`; hands the execute phase to the `Workflow` tool. |
| Parallel orchestrator | `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` | Probe touch-sets → partition into provably-disjoint worktree lanes (concurrent) + one serial lane for anything entangled/uncertain → merge one-at-a-time with a full gate per merge → replay a conflicted lane serially. |
| Mode override | both commands | `--parallel` / `--serial` flip either command per-invocation. |
| Throughput order | `we:docs/agent/backlog-workflow.md` (L558) | `--parallel` (independent, concurrent) > serial pack (independent, sequential) > cascade (dependent, sequential). |
| Cost-regime split | `we:docs/agent/backlog-workflow.md` (L440, L648) | Serial `/batch` **calibrates** a context-%→points budget; parallel `/workflow` **skips calibration** (points resolve in worktree subagent contexts, decoupled from the orchestrator's context — its ceiling is the token/agent budget, not context). |
| Readiness ranking | `we:scripts/check-readiness.mjs` (L1–12) | **Strictly deterministic by design** — "never authors content," reuses the loader's `tier`/`blockers`. No LLM in the ranker. |

The build lineage: the parallel orchestrator was delivered under epic
[#1143](/backlog/1143-safe-parallel-batching-via-workflow-orchestration/) /
[#1147](/backlog/1147-workflow-driven-batch-parallel-effects-manifest-serial-integ/). The safety contract
("serial is the safe baseline; partition only on provable independence; git is the conflict detector") is
codified in the orchestrator header and mirrored in the SKILL's *Parallel lanes* non-negotiables.

## Standing test — is there a fork at all?

Applying the fork-existence test to the card's three options:

- **(a) keep both / (c) serial-default + opt-in** — these *describe the shipped reality*. Not a fork; a
  confirmation.
- **(b) fold batching into Workflow (always parallel)** — the **excluded/broken** branch. Tightly-coupled
  items cannot be safely parallelized (their touch-sets overlap → worktree merge conflicts), and the
  orchestrator **already** routes those to the serial lane. Forcing always-parallel therefore adds probe +
  worktree-setup overhead and bimodal calibration noise with **zero** throughput benefit when items are
  coupled. A named-broken branch ⇒ no fork; ratify against it.

So the title question is a **support-both confirmation**, not a fork. But two genuine residuals survive:

1. **Routing/entry model** (real fork — both branches coherent, mutually exclusive as the *default*):
   keep **explicit** mode selection vs. an **auto-routing** single entry that probes disjointness and silently
   picks. This is the card's live design tension once the false "supersede" framing is removed.
2. **Structured-output (`agent({schema})`) adoption** (go/no-go on a candidate — the card's downstream note):
   where, if anywhere, to adopt the `Workflow` tool's provider-enforced schema validation.

## External prior art

**Orchestration frameworks make serial-vs-parallel an *explicit author choice*, not an auto-route.** CrewAI
exposes `Process.sequential` / `hierarchical` as a declared property of the crew; LangGraph models execution as
an explicit directed state-graph with conditional edges the author wires. Neither silently infers the execution
shape — the operator declares it. This supports keeping our mode selection **explicit** (the default for Fork 1).

**Structured output beats free-text parsing, and the gain compounds along a chain.** Provider-native schema
enforcement (tool-calling under the hood) yields near-deterministic parse success; free-text JSON parsing fails
a few percent per step, and a 10-step chain at 95%/step completes only ≈60% of the time. The reliability case
for `agent({schema})` is strongest exactly where one agent's output feeds the next — i.e. the parallel
orchestrator's multi-stage lanes and any decision-fork handoff — and weakest where the current path is *already*
deterministic (the readiness ranker, which uses no LLM at all).

## Classification (per-fork)

- **Fork 1 — routing model.** Layer: agent-tooling (skill/command surface, not a WE standard). The execution
  shape is a *data-dependent scheduler decision* (which packed items are disjoint today), recomputed per run by
  the probe — not a fixed graph the author encodes. **Default (post-skeptic) = (b) auto-routing single entry**:
  always run the probe, let the existing deterministic partition pick serial-vs-parallel, code-gate the
  calibration-skip on "did any lane run concurrently" (the `calibrate()` fit is mode-blind today, so the
  clean-estimate guarantee is prose-only), and keep `--serial`/`--parallel` as manual overrides. Residual the
  decider weighs: unifying on the orchestrator means every batch pays probe + worktree overhead and loses the
  inline-serial calibrated path.
- **Structured-output adoption — not a fork (supported by default).** `agent({schema})` is *already* adopted
  across the orchestrator's lanes (`PROBE_SCHEMA`, item-result, integrate, replay); the compounding probe→
  partition step the 0.95^N argument describes is already schema-validated, and fork pre-flight is reserved
  main-loop human judgment, not a lane handoff. The readiness ranker stays LLM-free as a **determinism /
  CLI-tab-parity invariant**, not a preference. No adoption decision remains; the only follow-on is hardening
  `PROBE_SCHEMA` validation.

## Skeptic pass (run in prep)

A refute-only sub-agent attacked both recommended defaults against the code. Outcomes folded into #1862:
**Fork 1 — REFUTED → flipped** from "keep explicit" to "auto-route": the probe already makes the
serial/parallel call at item granularity and `calibrate()` is mode-blind ([we:scripts/backlog.mjs](../scripts/backlog.mjs)),
so explicit selection offloads to operator + prose discipline what code can enforce; `--serial`/`--parallel`
retained as overrides. **Structured-output — SURVIVES-WITH-AMENDMENT → demoted** to "supported by default":
schema is already adopted across the lanes and the named "fork-parsing handoff" was mis-located (it's main-loop
judgment); ranker-exclusion hardened to an invariant.

## Sources

- [Comparing CrewAI, LangGraph, and BeeAI (IBM Developer)](https://developer.ibm.com/articles/awb-comparing-ai-agent-frameworks-crewai-langgraph-and-beeai/)
- [AI agent frameworks compared: LangGraph vs CrewAI vs AutoGen](https://pecollective.com/blog/ai-agent-frameworks-compared/)
- [LLM Structured Outputs: JSON Schema Enforcement and Tool Calling Reliability](https://eastondev.com/blog/en/posts/ai/20260506-llm-structured-output/)
- [The guide to structured outputs and function calling with LLMs (Agenta)](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [Schema First Tool APIs for LLM Agents (arXiv 2603.13404)](https://arxiv.org/pdf/2603.13404)
