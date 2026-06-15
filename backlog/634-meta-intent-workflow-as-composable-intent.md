---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "project:webworkflows"
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-workflow-meta-intent.md
tags: [intents, composition, workflow, meta-intent, protocol, statechart]
---

# Meta-intent — workflow as composable intent

> **Ruling (2026-06-14 — ratified A / A).** **Fork 1 = A:** workflow graduates to a new process-orchestration project **`webworkflows`** owning a **`workflow` protocol** (orchestration graph as a portable SCXML-style interchange + a swappable `CustomWorkflowEngine` provider seam + a step-transition event), with the UX as a separate **`flow-progress` intent** that reuses navigation's `structure:linear`/`guard`/`history` and the native `aria-current="step"` token; the concrete wizard is a later Block. **Fork 2 = A:** Tier-1 core mandatory + Tier-2 common optional, Tier-3 deferred but **captured on the protocol** as a "known-but-not-standardized" list, operator set stays an open meta-schema. #369 is subsumed; #616 stays a distinct sibling. Materialized into [projects.json](../src/_data/projects.json) / [protocols.json](../src/_data/protocols.json) / [intents.json](../src/_data/intents.json) + `project-webworkflows.njk`; the engine-adapter and wizard-block **builds** are filed as separately-prioritized items.

**Prepared — ready to ratify.** No design exists yet; this is a greenfield call grounded in a prior-art survey published as [`/research/workflow-meta-intent/`](/research/workflow-meta-intent/) (session report linked via `relatedReport`). Decides whether WE recognizes a **workflow** — a set of smaller UX intents arranged in *directed progression toward one goal* (`checkout = collect-address → pay → confirm`), with threaded state, a completion criterion, and a current position — and, if so, **where it lives** and **how rich its operator vocabulary is**. Two forks below, each with a **bold** recommended default. The "several valid ways to do workflows" are a configurable *register* dimension, not a fork (support-all). Surfaced by a 2026-06-14 reflection; it is the deliberate **sibling of [#616](/backlog/616-retroactively-ratify-the-weblifecycle-project-lifecycle-prot/)** (domain-entity lifecycle), which drew the boundary this item occupies.

## Axis framing

A workflow is the missing **third composition mode**. WE has two today: **simultaneous** — a block composes intents that all act at once (droplist's `composesIntents` at [blocks.json:23](../src/_data/blocks.json#L23), `implementsIntent` at [blocks.json:22](../src/_data/blocks.json#L22)); and **cross-cutting** — one intent's policy reused across blocks ([accessible-name intents.json:238](../src/_data/intents.json#L238), [live-region-status intents.json:155](../src/_data/intents.json#L155)). Neither expresses *directed/temporal* composition — step-intents progressing toward a terminal goal with threaded state. The concern decomposes into:

- **Coherence (settled — the fixed mechanic, not a fork).** Across every system surveyed (XState/SCXML, BPMN, GitHub Actions, Temporal, UI steppers) four things make a workflow a workflow rather than co-located intents: **threaded state · directed progression · one completion criterion · one current position**. This is mechanical enough to gate on. The intent meta-schema today has no field for it — intents carry `id`/`name`/`status`/`summary`/`dimensions`/`description` only ([motion example intents.json:3](../src/_data/intents.json#L3)); composition lives on blocks, not intents.
- **Placement (Fork 1).** The orchestration machinery (a graph of steps + transitions + guards + parallel + completion, run by a swappable engine) is **technical machinery**, not UX. By the [#409](/backlog/409-decision-master-detail-intent-vs-project/) placement test — a Project+Protocol needs a real contract (a provider seam *or* an interchange schema) — workflow passes on **both** disjuncts (a `CustomWorkflowEngine` registry *and* a portable SCXML-style orchestration graph), exactly as `lifecycle` did ([protocols.json](../src/_data/protocols.json)). So it decomposes like #616: machinery → Protocol, UX → Intent, concrete wizard → Block.
- **Operator scope (Fork 2).** *If* recognized, how large is the standardized operator set? The survey tiers it cleanly (core / common / niche).
- **Settled by precedent (not a fork)** — *workflow ≠ lifecycle.* [#616](/backlog/616-retroactively-ratify-the-weblifecycle-project-lifecycle-prot/)'s own survey drew the boundary verbatim: "*an FSM is in one state at a time, whereas BPMN allows a workflow to be in many … weblifecycle should not absorb a process-engine scope.*" A workflow is that excluded process-orchestration scope. Same SCXML transition-map *form*, different subject (persisted entity vs ephemeral user traversal), cardinality (one state vs many), and event (audit trail vs back/undo). **Siblings, not twins** — bias-to-separation.
- **Register (not a fork)** — wizard/stepper · single-page progressive disclosure · conversational · board are all coherent end-states → a configurable dimension on the UX intent, most-permissive default.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 · Placement | **Project + Protocol + Intent decomposition** (machinery=Protocol, UX=Intent, wizard=Block) | Intent-only · fold into `weblifecycle` · new entity | High |
| 2 · Operator scope | **Tier-1 core mandatory + Tier-2 optional; defer Tier-3; open meta-schema** | Minimal-only · maximal (incl. saga/retry) | Med-high |

## Fork 1 — Where does a workflow live in the constellation?

**Crux:** orchestration (transitions, guards, parallel, a runnable engine) is impl/technical machinery, and intents are UX-only (no impl refs). The #409 placement test + the #616 precedent say a transition-machine with a provider seam and a portable interchange is a **Protocol owned by a Project**, with the UX rendered by a separate **Intent**. A workflow is the process-orchestration instance of exactly that shape.

- **A — Project + Protocol + Intent decomposition (recommended).** A process-orchestration **Project** owns a **`workflow` Protocol**: the orchestration graph (steps + transitions + guards + parallel/fork-join + completion) as a portable, data-defined interchange (SCXML/statechart form), resolved by a swappable **`CustomWorkflowEngine`** registry (XState / SCION / a hand-rolled switch plug in behind it), emitting a step-transition event. The **UX** (current position, per-step status, register) is a separate **Intent** (UX-only) that *reuses* the [navigation intent](/intents/navigation/)'s `structure:linear` + `guard` + `history` dimensions ([intents.json:1198](../src/_data/intents.json#L1198)) rather than reinventing them, and adopts the native `aria-current="step"` token. The concrete wizard/flow is a **Block** that `composesIntents` (composition stays block-owned — no new ownership home). This is the #616 shape applied to the scope #616 explicitly excluded.
- **B — Intent-only (no protocol/project).** A "workflow" is just a UX intent carrying orchestration fields. *Rejected:* guards, transitions, parallel, and a runnable engine are technical machinery — putting them on an intent violates the intent-is-UX-only boundary (intents carry no impl refs) and re-creates the exact contract #409/#616 ruled is a Protocol. Master-detail stayed a plain intent because it had **no** contract; workflow **has** one (engine seam + graph interchange), so the test lands the other way.
- **C — Fold into `weblifecycle` (reuse the `lifecycle` protocol).** *Rejected:* #616's survey drew the principled boundary — an FSM is in one state at a time; a workflow/BPMN process can be in many — and stated weblifecycle "should not absorb a process-engine scope." Subject (entity vs user-traversal), cardinality, event semantics (audit vs back/undo) and persistence all differ. Bias-to-separation: siblings over a shared transition-map form, not one protocol.
- **D — New top-level entity ("flow"/"meta-intent").** *Rejected:* the existing Project+Protocol+Intent+Block quartet already models a transition-machine (the #616 precedent proves it). A new entity is unjustified weight — the bias-to-separation cuts against adding a kind when existing kinds compose.

**Default: A — Project + Protocol + Intent decomposition.**

## Fork 2 — How rich is the standardized operator vocabulary?

**Crux:** the survey's cross-system comparison (statecharts / BPMN / GitHub Actions / Temporal / UI steppers) tiers the operators by universality. Standardize what recurs everywhere; leave the rest to the engine behind the provider, per #085 ("standardize the meta-schema, not the list").

- **A — Tier-1 core mandatory + Tier-2 optional, defer Tier-3, keep the set an open meta-schema (recommended).** **Core (the coherence invariant):** sequence · branch/guard · nest (sub-workflow) · threaded context · completion/final · current-position. **Common (optional):** parallel fork/join · back/undo (the UI-specific operator every wizard needs) · gate/wait-for-event. **Deferred (Tier-3):** fan-out/matrix (a parallel specialization), history/resume, retry, compensation/saga (durable-execution backend concerns), inclusive-OR (BPMN-only; expressible as parallel + per-branch guards). Adapters/engines declare *which* operators they honor — the [#085](/backlog/085-validation-adapters-multi-language/) compliance-matrix posture.
- **B — Minimal-only (sequence + branch + completion).** *Rejected:* parallel and back/undo recur across every surveyed system and every UI wizard; omitting them forces an escape hatch on day one.
- **C — Maximal (all operators, incl. retry / compensation / saga).** *Rejected:* retry/compensation/saga are durable-execution (Temporal) backend concerns, not UX-flow composition — baking them in is lock-in for zero UX gain (a protocol is the single escapable lock, never reached for casually); they belong to the engine behind the provider, not the contract.

**Default: A — tiered core+common, defer niche, open meta-schema.**

---

## Context (not part of the call)

**Per-fork classification (7-question pass).**
1. **Which layer?** Splits across layers — orchestration machinery → **Protocol** (owned by a Project); UX (position/status/register) → **Intent**; the concrete wizard → **Block**. This split *is* Fork 1.
2. **Protocol or intent dimension?** The orchestration graph is a **Protocol** — it carries a provider seam (`CustomWorkflowEngine`) + a portable interchange (SCXML-style transition graph) + an observable transition event: the #616/#409 technical-contract signature. The UX is an **Intent** (no impl refs).
3. **Expose the whole axis?** Yes — the **register** (wizard/single-page/conversational/board) is exposed as a configurable dimension; the **operator set** is the open meta-schema authors extend.
4. **Fixed mechanic or dimension?** The **coherence invariant** (threaded state + directed progression + completion + current-position) is a *fixed mechanic* — it defines "workflow." Register and operator selection are *dimensions*.
5. **DI-injectable?** Yes — `CustomWorkflowEngine` is a **runtime-DI seam** (the running flow consults the engine to execute transitions — genuine runtime DI, not a devtools provider consulted once at build time), directly parallel to `CustomLifecycleProvider`.
6. **Most-permissive default?** Register default = most flexible; default arrangement = sequence; guards optional (free progression by default); back/undo allowed by default.
7. **Seam between intents?** A workflow sits at the seam *composing* step-intents — orchestration lives on the workflow protocol/intent; the step-intents compose into it and stay unaware they are in a flow (they don't gain a workflow dimension).

**Supported by default (not decisions).**
- **Reuse, don't reinvent.** The UX intent reuses navigation's `structure:linear`/`guard`/`history`; the position indicator adopts native `aria-current="step"`; per-step status adopts the cleanest surveyed enum (`wait`/`process`/`finish`/`error` + `disabled`, `optional` orthogonal). Avoid the name "stepper" (collides with the numeric NumberField).
- **Subsumes [#369](/backlog/369-collection-operations-coordinator/)** — the collection-operations coordinator is "co-located stateful composition," a degenerate instance the general standard covers.
- **Distinct from [#616](/backlog/616-retroactively-ratify-the-weblifecycle-project-lifecycle-prot/)** — lifecycle = a persisted domain entity's status (FSM, one state); workflow = the user's traversal (process orchestration, may be many). Shared SCXML form, separate protocols.

**On resolution** (when ratified): if Fork 1 = A, graduate to a process-orchestration **project** (`webworkflows`) + a `workflow` **protocol** entry (provider seam + transition-graph interchange + event) and a workflow-UX **intent** entry, then file the builds (engine adapter, wizard block) as separately-prioritized items. Operator scope (Fork 2) seeds the protocol's documented operator list — **all three tiers are captured on the protocol**, not just the blessed ones: Tier-1 (core/mandatory) + Tier-2 (common/optional) as honored operators, and **Tier-3 recorded as an explicit "deferred / known-but-not-standardized" list with a one-line reason each** (redundant-via-existing-primitive: matrix→parallel, inclusive-OR→parallel+guards; or engine-backend-concern: retry/saga/history-resume). Because the set is an open meta-schema, promoting a Tier-3 operator later is a status flip, not a re-survey. A Technical Configurator card may expose engine selection; the register is a UX dimension, not a technical setting.