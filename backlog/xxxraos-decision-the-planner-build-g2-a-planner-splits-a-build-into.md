---
kind: decision
parent: "3383"
status: open
relatedTo: ["3575", "3801", "3717", "3730", "3857", "3784", "3850", "3690"]
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/operations/dispatch-task.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/deliver-item-wrapper.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Decision: the planner build (G2): a planner splits a build into a JSON plan of typed steps, each run by a script or dispatched to the cheapest capable model

Operator ask, repeated 2026-09-19, 09-20, 09-21 and 09-22: a build should not be one worker writing the whole card. A planner (Codex or Sonnet) writes a JSON plan of ordered steps, each with dependsOn, a taskType from a fixed enum and a size estimate. The mechanical orchestrator then runs each step itself when a script can, or dispatches it to the cheapest capable model (Gemini Flash favoured where it has graduated). Steps with no dependency run in parallel. Until now this lived only as follow-up 1 (G2) of #3801 ('none filed yet') and as tracker item 6 in the prototype branch's copy of #3383; it had no card. CHECKED 2026-09-22, NOTHING OF THE PLANNER IS BUILT: no plan format exists, and nothing calls the router's story stage (we:scripts/lib/dispatch-contracts.mjs on the prototype has the build-supervisor role and the task-agent stage, unused). PIECES THAT EXIST: the router we:scripts/lib/provider-routing.mjs (#3690, graduating in #3897); the dispatch routing contract (#3717 children, prototype); the dispatch-task operation that launches a worker from a brief file (#3730, built on the prototype, not on main); the model-by-kind routing table (#3857, open); gemini-direct-task and codex-direct-task. OPEN QUESTIONS TO PREPARE (from #3801 follow-up 1): a closed task-kind and cause vocabulary for per-task dispatches (dispatch-task's kind is a free label today); who may declare a step's taskType; a self-fix kind if a rework loop appears; the size source for a step (#3801 Fork 4); what satisfies full supervision for a step (#3784, #3850); what the deliveryAgent marker means under a planner build (#3801 Fork 5); how steps integrate back into one deliverable and whether a card is splittable at all, which is #3575 Forks 1 to 3 (sub-briefs through the parallel-execute disjoint-lane assembly), so rule this with or after #3575. Cautions from the operator direction: the router consumes only the plan's fixed enum fields, never the planner's judgment; favouring Gemini is an ordered preference in an auditable table, and is mechanical only once Gemini has graduated for that taskType (N=5 trials); every step records the provider that ran it. Prototype work under #3383: build on lane/mechanical-dispatcher, graduate through #3443.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
