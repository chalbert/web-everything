---
bornAs: xyr248a
kind: decision
parent: "2677"
status: resolved
relatedReport: reports/2026-07-27-conveyor-orchestration-boundary.md
dateOpened: "2026-07-27"
dateResolved: "2026-07-27"
codifiedIn: "docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent"
preparedDate: "2026-07-27"
tags: []
---

# Conveyor orchestration boundary: how much is pure mechanics vs a per-lane agent

Once the tick core is a mechanized, tested state machine ([#2699](/backlog/2699-mechanize-the-conveyor-tick-core-into-a-tested-state-machine/) + [#2700](/backlog/2700-wire-ghost-release-lease-reaper-pr-watch-release-session-and/), **both landed**), **how is each lane driven?** #2677 deferred exactly this: where the line falls between the deterministic mechanical core (dispatch / watch / release / tick / guards — reproducible, testable, product-ready with no session) and per-lane orchestrator autonomy. It gates the per-lane orchestrator slice (#2702 is `blockedBy` it), so that brief is written against a settled boundary.

> **RATIFIED by the operator on 2026-07-27 — Option A adopted (see the RATIFIED block below).** This card recorded an already-converged ruling: a multi-agent red-team convergence ran this boundary in the operator's live session and reached **HIGH confidence, `escalate = NO`** (a clean convergence). It was surfaced for **explicit operator ratification anyway** because the ruling **overturns the operator's earlier lean toward the per-lane agent (Fork 1 (b))** — a converged ruling that reverses prior operator direction is not auto-applied — and the operator has now ratified it. Full record + provenance: **`we:reports/2026-07-27-conveyor-orchestration-boundary.md`**. Convergence trace: hand-run ad-hoc via the Workflow orchestrator (not a persisted juror transcript); the fact that it ran is anchored on-disk by sibling **[#2704](/backlog/2704-code-decision-routing-into-the-conveyor-red-team-convergence/)** (resolved), which cites this exact decision as its worked example.

## RATIFIED — 2026-07-27 (operator)

**Option A adopted.** Conveyor per-lane orchestration is **pure deterministic mechanics + a headless runner** driving the tick-core state machine — no per-lane LLM. **Option B (a per-lane conducting agent) is rejected**; **Option C (a single cross-lane supervisor) is deferred** behind a measured escalation-volume trigger. Rationale: the per-lane cycle is fully script-decidable, so mechanics give reproducibility, testability, a session-free product path, and O(1) cost, while B re-clones the central-session fragility N times at N× cost. Codified as the statute **[we:docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent](/docs/agent/platform-decisions/#conveyor-orchestration-mechanics-not-per-lane-agent)** — a child application of `#deterministic-core-thin-judgment` (#2607), reconciled by citation, not a competing statute.

## The ruling (adopted)

- **Fork 1 → (a): drive each lane with pure deterministic mechanics + a headless runner** advancing the tick-core state machine. No LLM in the per-lane driving loop. **The per-lane conducting agent (b) is rejected.**
- **Fork 2 (escalation-triage supervisor) → not-yet:** defer a single cross-lane supervisor agent behind a measured escalation-volume trigger.

## Build conditions (for the runner this unblocks)

1. **Durable guard state** — the tick core needs guard state surviving a runner restart. **Delivered in #2699.**
2. **Singleton lock on the headless runner** — two runners must not double-dispatch the same lane/item; the runner needs a single-writer lock (mirrors the drain daemon's sole-writer discipline). This is the one net-new build condition Fork 1 (a) imposes.

## What ratifying unblocks

- **[#2702](/backlog/2702-per-lane-orchestrator-brief-plus-runner-driving-the-mechanic/)** — **reframed as the headless runner, NOT a per-lane conducting agent.** Its brief becomes "a runner driving the mechanical tick core for one lane," written against this settled boundary. (`blockedBy` this decision + #2699.)
- **[#2703](/backlog/2703-retire-the-main-session-serial-conveyor-loop-main-session-dr/)** — retire the main-session serial loop: the main session drops to genuine judgment (escalation review, forks, ratifying) + operator conversation only.

Both children already exist and are already `scope:`-carved (#2702 → `we:skills-src/conveyor/`, #2703 → `we:skills-src/conveyor/SKILL.md`); ratifying this boundary settles the framing their briefs are written against — it carves no new children.

## Fork 1 — how is each lane driven?

**Fork exists:** the per-lane *driver* is a single seat — either the deterministic tick-core state machine drives the lane (a headless runner just advances it) **or** an LLM agent conducts the lane (re-deriving the plan each tick). The two cannot both be the driver, so this is a genuine either/or; the excluded branch is (b), the per-lane conducting agent.

- **(a) Pure deterministic mechanics + a headless runner — DEFAULT (the ruling).** Everything script-decidable — dispatch, watch, release, tick, the three guards, watcher arming — runs as the tested state machine landed in #2699/#2700. A **headless runner** (no LLM) advances that machine per lane; only genuine judgment (escalation review, forks) stays with an agent, in the main session. This is [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](/docs/agent/platform-decisions/#deterministic-core-thin-judgment) (#2607) applied to the conveyor's *own* orchestration. Grounded in the already-landed core under `we:scripts/conveyor/` (tick + guards, #2699) and the ghost-release / health wiring (#2700).
- **(b) A per-lane LLM agent conducts each lane — REJECTED.** An agent per lane re-derives dispatch / watch / release decisions each tick. Rejected on four grounds:
  1. **Correlated outages stall all N lanes at once** — one provider/model outage or a shared prompt/tooling regression takes down every lane's conductor simultaneously (a fleet-wide single point of failure mechanics don't have).
  2. **N× context/token cost** — one conducting agent per lane multiplies per-lane token+context spend by pool size, for script-decidable work.
  3. **It re-creates the central-session fragility, per lane** — #2677's goal is to get *conducting* out of a fragile single session; (b) clones that fragility N times instead of removing it.
  4. **It contradicts the stated goal** — #2677(a) is explicitly "mechanize … a state machine, **not** an AI-in-the-loop conductor." (b) *is* an AI-in-the-loop conductor.

**Tradeoff:** (a) trades away per-lane adaptive re-planning (a runner does only what the state machine encodes) for reproducibility, testability, a session-free product path, and O(1) cost. That trade is the whole point — adaptive re-planning is exactly the AI-in-the-loop conducting #2677 set out to remove.

**Illustrative shape** — the per-lane driver under (a) is a headless advance loop over the tested core, not a reasoning agent:

```js
// (a) headless runner — one singleton-locked process advances the mechanical core per lane
import { withRunnerLock } from "we:scripts/conveyor/runner-lock.mjs"; // build condition 2
import { tick } from "we:scripts/conveyor/tick.mjs";                  // the #2699 state machine

await withRunnerLock(async () => {          // singleton: no two runners double-dispatch
  for (;;) {
    const next = tick(loadGuardState());    // pure: dispatch/watch/release/guards decided by the machine
    persistGuardState(next.state);          // durable guard state (delivered #2699)
    if (next.escalation) surfaceToOperator(next.escalation); // the ONLY thing an agent sees
    await sleep(next.delayMs);
  }
});
// (b) rejected: `const plan = await llm(conductLanePrompt(...))` per lane, every tick.
```

**Skeptic:** SURVIVES. The multi-agent red-team convergence attacked (a) directly and A held at HIGH confidence, `escalate = NO`. The strongest pro-(b) attack — "a mechanical runner can't handle novel lane situations" — is answered by the escalation seam: novel situations *escalate* to judgment (the main session, or later Fork 2's supervisor), they are not conducted by a per-lane LLM. Classification axis: this is not a config dimension (the two branches are not two values of one knob — they are mutually-exclusive drivers) and not support-both (you cannot have both an LLM and the state machine be *the* driver without re-introducing (b)'s cost/fragility). Statute-overlap: the codified claim applies #2607's `#deterministic-core-thin-judgment` rather than competing with it — reconciled by citation, no same-turf collision. Citation-scope: #2607 governs exactly this turf (script-decidable delivery-loop machinery → mechanics), so the citation is authority, not mere context.

**Screen:** clear. (1) Not an impl detail hidden across a boundary — the driver model is the conveyor's observable orchestration architecture and the thing #2702's brief is written against. (2) With both branches free to build and instantly maintained, a real *merit* gap remains: (b) still carries correlated-outage risk, N× cost, and cloned session-fragility that (a) structurally lacks — so this is merit, not prioritization in fork costume.

## Fork 2 — a single escalation-triage supervisor agent? (validation gate)

Not a per-lane fork — a one-sided go/no-go on *adding* a single cross-lane supervisor agent that triages escalations across all lanes (distinct from Fork 1's rejected *per-lane* agent).

- **Digest + verdict: NOT-YET (defer behind a measured trigger).** Under the ruling, escalations surface directly to the operator (unchanged from today). A single supervisor agent that pre-triages them is a coherent future addition but not warranted now.
- **Prior-art delta:** the escalation seam already exists (the runner surfaces escalations; the main session reviews them). #2704 (resolved) already codes criticality-routing + auto-dispose for *decisions*; a *supervisor* over lane-escalations is a different, additive layer with no current volume pressure behind it.
- **Why not a fork:** there is no excluded branch — "no supervisor" is a coherent, shipped end-state, and "add a supervisor" is a candidate addition, not its mutually-exclusive alternative. It is a candidate awaiting evidence, so it takes the validation-gate shape, not a `## Fork N` with a ratifiable default.
- **Concrete un-gate trigger:** build it only when observed escalation volume shows the operator's direct-review path is a bottleneck (e.g. sustained escalation arrival rate exceeding human triage throughput over a measured window). Absent that signal, do not build it.
- **Skeptic:** SURVIVES. Attack: "triage should be built alongside the runner so escalations aren't dropped." Answer — escalations are never dropped without it; they surface to the operator exactly as today. A supervisor only *automates* triage, which is pure added cost until volume justifies it. Deferring is the most-permissive, lowest-lock-in call.

## Lineage

Parent #2677 (epic) → the boundary it de-buried. Core already landed: #2699 (tick state machine + guards) + #2700 (ghost-release + health wiring). Statute applied: #2607 `#deterministic-core-thin-judgment`. Convergence provenance + full record: `we:reports/2026-07-27-conveyor-orchestration-boundary.md`; on-disk anchor that the convergence ran: #2704 (resolved). Children this gates: #2702 (headless runner), #2703 (retire the serial loop).
