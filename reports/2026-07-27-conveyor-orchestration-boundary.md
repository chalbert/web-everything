# Conveyor orchestration boundary — red-team convergence (decision #2701)

**Date:** 2026-07-27
**Decision:** [#2701](/backlog/2701-conveyor-orchestration-boundary-how-much-is-pure-mechanics-v/) (`bornAs: xyr248a`, parent [#2677](/backlog/2677-conveyor-orchestration-mechanize-the-core-delegate-to-per-la/))
**Status of this report:** durable record of an already-run convergence — the ruling below was reached in the operator's live red-team session; this report preserves it faithfully. It is the `relatedReport` #2701 links.

## Provenance of the ruling (the trace)

The multi-agent red-team convergence on this boundary was **hand-run ad-hoc via the Workflow orchestrator** in the operator's live session — the same run that also exercised the feature-tracker design. It was **not** persisted as a separate juror-by-juror transcript. That the machinery ran here (and worked) is recorded independently by sibling **[#2704](/backlog/2704-code-decision-routing-into-the-conveyor-red-team-convergence/)** (resolved): *"It was hand-run ad-hoc via Workflow for the feature-tracker design and decision #2701 (the conveyor-orchestration-boundary decision) — which PROVES the machinery works but also proves it is not yet WIRED into the conveyor."* #2704 is the on-disk anchor for the fact that the convergence occurred; this report is the on-disk record of *what it concluded*.

**Convergence outcome:** HIGH confidence, `escalate = NO` (clean convergence, no genuine non-contention). Surfaced for **explicit operator ratification anyway** because it **overturns the operator's earlier lean toward the per-lane agent (Option B)** — a converged ruling that reverses the operator's prior direction is not auto-applied.

## The question

Once the tick core is a mechanized, tested state machine ([#2699](/backlog/2699-mechanize-the-conveyor-tick-core-into-a-tested-state-machine/) + [#2700](/backlog/2700-wire-ghost-release-lease-reaper-pr-watch-release-session-and/), **both landed**), **how is each lane driven?** #2677 deferred exactly this: where the line falls between the deterministic mechanical core and per-lane orchestrator autonomy.

## Options considered

- **Option A — pure deterministic mechanics + a headless runner** driving the tick-core state machine per lane. **← ADOPT.**
- **Option B — a per-lane LLM agent** conducting each lane. **← REJECT.**
- **Option C — a single escalation-triage supervisor agent** (one agent, not one-per-lane, triaging escalations across lanes). **← DEFER** behind a measured trigger.

## The ruling — A (mechanics + headless runner)

Drive each lane with the **deterministic tick-core state machine advanced by a headless runner** — no LLM in the per-lane driving loop. This is the same line [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](/docs/agent/platform-decisions/#deterministic-core-thin-judgment) (#2607) already draws for the delivery loop, applied to the conveyor's own per-lane orchestration: everything script-decidable (dispatch, watch, release, tick, guards) runs as mechanics; only genuine judgment stays in an agent.

### Why B is rejected

1. **Correlated outages stall all N lanes at once.** An LLM per lane means one provider/model outage (or a shared prompt/tooling regression) stalls *every* lane simultaneously — a fleet-wide single point of failure that pure mechanics do not have.
2. **N× context/token cost.** One conducting agent per lane multiplies the per-lane token and context spend by the pool size, for work that is script-decidable.
3. **It re-creates the central-session fragility, per lane.** The whole point of #2677 is to get *conducting* out of a fragile single session. A per-lane agent doesn't remove that fragility — it clones it N times.
4. **It contradicts the goal.** #2677(a) is "mechanize the deterministic orchestration into a state machine, not an AI-in-the-loop conductor." B is an AI-in-the-loop conductor.

### Why C is deferred (not rejected)

A single cross-lane escalation-triage supervisor is a *coherent* future addition — but only earns its cost if escalation volume later proves a human bottleneck. Defer behind a **measured trigger**: build it only if observed escalation volume warrants triage automation. Until then, escalations surface to the operator directly (unchanged).

## Build conditions (for the runner this unblocks)

1. **Durable guard state** — the tick core needs guard state that survives a runner restart. **Delivered in #2699.**
2. **Singleton lock on the headless runner** — two runners must not double-dispatch the same lane/item. The runner requires a single-writer lock (mirrors the drain daemon's sole-writer discipline).

## What ratifying unblocks

- **[#2702](/backlog/2702-per-lane-orchestrator-brief-plus-runner-driving-the-mechanic/)** — **reframed as the headless runner**, NOT a per-lane conducting agent. Its brief is now "a runner driving the mechanical tick core for one lane," written against this settled boundary.
- **[#2703](/backlog/2703-retire-the-main-session-serial-conveyor-loop-main-session-dr/)** — retire the main-session serial loop: the main session drops to genuine judgment + operator conversation only.

## Statute relationship (no conflict)

This ruling **applies** #2607's `#deterministic-core-thin-judgment` anchor to the conveyor's per-lane orchestration; it does not compete with it. If #2701 later sets `codifiedIn`, the rule it writes is a *downstream application* of that anchor (per-lane driving is script-decidable → mechanics), reconciled by citation, not a same-turf collision.
