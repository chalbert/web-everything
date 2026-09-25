---
bornAs: x1ojdxq
kind: epic
priority: high
parent: "3718"
status: resolved
relatedTo: ["3690", "3695", "3696", "3443", "3658", "3720", "3730", "3801", "3784"]
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/lib/__tests__/dispatch-task-type.test.mjs"]
dateOpened: "2026-09-19"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
graduatedTo: none
tags: []
---

# Choose the dispatch provider mechanically from fixed criteria: wire provider-routing into the dispatch path and derive taskType from the dispatch

`we:scripts/lib/provider-routing.mjs` (#3690) is a finished, pure, deterministic router with no real caller, so every worker this session dispatched was told it MAY delegate to Codex and none did. Wire it into the dispatch path so the provider and supervision level are computed from declared criteria, derive its `taskType` from the dispatch itself, refuse a dispatch that has none, publish the routing table, and record the provider actually used so trials feed back.

**Acceptance test (the operator's, 2026-09-19): no model judgment anywhere between the dispatch kind and the chosen provider.** The operator's stated intent is "ideally routing would be mechanical from fixed criteria" and that delegation is mechanically forced, not advice in a brief.

## What exists

- The router: `selectProvider(task, context)` picks `gemini`, `codex`, `both` or `claude`; `selectSupervisionLevel(provider, model, taskType, scorecards, thresholds)` picks `full` or `spot-check`. Its criteria are stated in its own header: the `{provider, model, taskType}` trust unit, N = 5 clean trials, the informative-trial requirement, the calibration-miss hard veto, first-fit cascade order, statute-tier paths forcing Opus. It does no IO, so the caller loads scorecards from `we:scripts/conveyor/run-scorecards.json`.
- **Zero callers.** A search for `selectProvider` and `selectSupervisionLevel` finds only the module, `we:scripts/lib/model-capability-ratings.mjs`, its own test, and cards #3695 and #3696. Nothing in `we:scripts/operations/dispatch-lane.mjs`, `we:scripts/operations/review-dispatch.mjs`, `we:scripts/conveyor/reconcile-fix-dispatch.mjs` or any skill consults it.
- The seam to obey it through: `we:scripts/operations/dispatch-lane-io.mjs` already has a `provider` port (#3579) with `defaultClaudeProvider` as the only implementation on `main`. `dispatch-provider-registry` and any Codex or Gemini provider port live on the ungraduated `lane/mechanical-dispatcher` branch (#3443, #3658).

## The real gap is the input, not the router

`selectProvider` reads `taskType` from its caller and silently defaults it to `bugfix` when absent (`task?.taskType || 'bugfix'`). If a model picks the `taskType`, the routing is only as mechanical as that guess. So `taskType` must be DERIVED from facts the machinery already holds. The mapping is **not 1:1 today**, and that mismatch is the work:

| Router `taskType` | Dispatch kind that produces it today | Note |
|---|---|---|
| `build-new-feature` | `build` (`BRIEF_REQUIRED_BY_KIND` in `we:scripts/operations/dispatch-lane.mjs`) | derivable |
| `doc-fix` | none; a `build` whose declared `scope` paths are all docs | derive from the item's `scope`, not the kind |
| `bugfix` | `fix`, `ci-heal` | derivable |
| `conflict-resolution` | none; a `fix` dispatched because a bounce was conflict-caused | `we:scripts/conveyor/reconcile-fix-dispatch.mjs` already reads the cause; it is a cause, not a kind |
| `self-fix` | none | no dispatch kind produces it; decide whether it exists mechanically at all |
| `other` | none | 10 of the 26 scorecard records are `other`: the catch-all that cannot be derived |
| (no `taskType`) | `review` (`we:scripts/operations/review-dispatch.mjs`, reconcile `kind: 'review'`), `prepare`, `prepare-decision` | authoring or judging roles, not code changes; the router already forces native Claude for architectural-decision and triage-research work |

All 26 scorecard records carry `dispatchKind: 'session-delegation'`. None come from a mechanical dispatch kind. The router's trust unit ignores `dispatchKind`, so those trials would count toward the same `taskType` under mechanical dispatch; whether that is right is a #3690 question, and until real mechanical trials exist most decisions will resolve on thin history to `both` or `claude`. That is the safe direction, and recording the provider used is what starts the data.

## Proposed shape

1. A new pure `we:scripts/lib/dispatch-task-type.mjs`: `taskTypeFor({ kind, cause, scopePaths })` returns a router `taskType` or `null`. **`null` refuses the dispatch** with a named reason; there is no default and the router's silent `bugfix` default must be unreachable from this call site.
2. One shared wrapper `chooseProvider(dispatch, { override })`: load the scorecards at the IO edge, call `selectProvider` and `selectSupervisionLevel`, return `{ provider, level, taskType, reasons }`. Called by `dispatch-lane`, `review-dispatch`, `reconcile-fix-dispatch` and `dispatch-task` (#3730) **before** the spawn.
3. **The run record stores both `routed` and `executed`.** A dispatch records the provider it actually used, so a silent fallback (routed `codex`, executed `claude`) is visible in the trial data instead of corrupting it.
4. **The override is an explicit, recorded input** at the call site (`--provider-override=<p> --override-reason=<text>`), stored in the run record. It is never a sentence in a brief telling an agent to "prefer" something.
5. **The criteria are written down where a human can audit them:** one table of `{dispatch kind → taskType → routing decision given today's scorecards}`, generated from the same pure functions and checked into `we:docs/agent/dispatcher-runbook.md`, with a test that fails when the checked-in table drifts from what the code produces. That table is also what makes a wrong route debuggable.
6. **The execute half depends on a provider port.** Until a Codex or Gemini provider port is on `main` (#3443, #3658), a non-Claude decision is recorded as `routed: codex, executed: claude`, and the table shows the gap. Then the brief's "you MAY delegate" sentence is replaced by the computed decision, and the harness, not the agent's word, supplies the provider in the completion record.

## Could a PreToolUse hook enforce it?

Only partly, and it is not the gate. A hook sees the command string, so it can require a routing flag on a `dispatch-lane` call or flag a raw `claude --bg` worker launch, but it cannot tell whether a decision was computed or typed. **The deterministic half is the operation itself refusing to spawn without a derived `taskType` and a recorded decision.** A warn-level `we:scripts/guard-bash.mjs` rule for a raw launch that bypassed the operation is an optional backstop, and it shares the follow-on named in #3730.

## Flag for the operator: this encodes a graduation model nobody has ratified

The router implements #3690's progressive-backdown model, but #3690 is still an open decision. Wiring turns that model into a dispatch gate. If the operator's statement above is meant as the ruling, ratify #3690 so the thresholds are not running ahead of a ruling. Related, not duplicated: #3695 (keeping external capability ratings current, which feeds only the advisory `explorationHint`) and #3696 (making Antigravity the default recommendation, which changes the router's outputs and regenerates the table, not the wiring).

ADDED 2026-09-21 (finding, not a ruling; the forks below are OPEN to the operator's review). **What was built, and on whose word.** The operator answered "Yes for 3717" (typed in the orchestrating session), with the design gap G2 folded in ("Ok then yes to all"). The work was built on the prototype branch `lane/mechanical-dispatcher`, commit 0f1d0fb8f (verified: the commit is on that branch). It is not on `main`, and there is no PR: the prototype branch is not landed through the drain. **What it is:** one entry point, `routeDispatch`, which composes `selectProvider` and `selectSupervisionLevel` (verified in `we:scripts/lib/dispatch-contracts.mjs`: it calls both), so no second router was added. The `taskType` is derived from the dispatch by the new `we:scripts/lib/dispatch-task-type.mjs`. The route the criteria chose (`routed`) and the provider that actually ran (`executed`) are recorded separately. Supervision is recorded but NOT enforced: enforcement sits behind `WE_DISPATCH_SUPERVISION_ENFORCE`, off by default. #3690 is now ratified (resolved 2026-09-21, codified in `we:docs/agent/platform-decisions.md#delegation-trial-record-graduation`), so the follow-on story to turn enforcement on is #3784 (bornAs 3784). The routing table is published in `we:docs/agent/dispatcher-runbook.md`. **The five forks (A to E), copied from the builder's result (the `build-3717` result file in the operator's job-results folder, outside this repository), and how each was resolved. All five are open to the operator's review:**
- **A.** Which `routeDispatch` stage a launch is. Resolved: the code-change kinds route at `stage: 'task'`. Only that stage runs the provider cascade, and the card's own `routed: codex, executed: claude` record is impossible at the story stage. If a `build` launch is meant to be a story-stage supervisor, the change is one argument in `decideDispatchRoute`.
- **B.** The three `taskType` values no dispatch kind produces. Resolved: `self-fix` and `other` are never produced, and `conflict-resolution` is produced only by a conflict cause. No `self-fix` kind was invented. Stated as data and asserted in a test.
- **C.** A role dispatch's `taskType` (review, prepare, prepare-decision). Resolved by refusing to guess: a role dispatch never calls the router and is recorded as `routed: null`. Its Claude spawn is unchanged.
- **D.** An unsized card. Resolved: an unknown size reads as 900 LOC, the largest band, outside every proven envelope, and the record carries `sized: false`. Refusing would stop about a third of the conveyor, and understating is the dangerous direction.
- **E.** Where the override lives. Resolved: `WE_DISPATCH_PROVIDER_OVERRIDE` plus `WE_DISPATCH_OVERRIDE_REASON`, both required, read at the IO edge, because the operation's declared input set is pinned by a test. The card's `--provider-override` flag can be added later without changing the decision logic.

The builder's result also records a sixth item, F (the route is computed in the IO shell, and only the derivation and refusal run in the pure declaration, because of an import-graph rule on `we:scripts/operations/dispatch-lane.mjs`), and one deliberate omission: `dispatch-task` (#3730) is not wired to the router yet, since its `kind` is a free label. **Second finding, the Codex/Gemini wrapper.** The mechanical wrapper for Codex/Gemini delegation is effectively the provider port of `dispatch-lane`, not a separate thing. The seam already exists: `we:scripts/operations/dispatch-lane-io.mjs` has a `provider` port whose only implementation on `main` is `defaultClaudeProvider`, and `we:scripts/operations/dispatch-provider-registry.mjs` (on the prototype branch) is the registry. So the wrapper should be built as a provider behind the routing above and not as a parallel path. Not verified by me: the design notes of the orchestrating session that state this; I checked only that the seam is there.

## Finding (2026-09-21): built on the prototype; its five choices went to #3801, now ruled

Built on the prototype branch (`0f1d0fb8f`, contained in `origin/lane/mechanical-dispatcher`), not on `main`. The build stopped at five forks and chose the smallest reading of each; they are decision card 3801 for the operator's review: (A) a code-change launch routes at the `task` stage, not `story`; (B) the task types no dispatch kind produces are never produced; (C) role dispatches never call the router; (D) an unsized card reads as 900 lines; (E) the override is two environment variables, not a flag. Separately noted by the build and not a fork: every route resolves to Claude today because the 18 scorecard records carry no task type and no outcome.

## Sliced 2026-09-21 after the #3801 ruling (now an umbrella epic)

#3801 was ruled on 2026-09-21. Forks 1 and 2 keep the build; Forks 3, 4 and 5 and the *Settled by statute* points change it. This card is now the umbrella for that work and carries no size (its children do). The five forks listed above are ruled; read #3801's `## Ruling`, not the list above, for what holds. Every child is built on the prototype branch `lane/mechanical-dispatcher` (commit straight to it, no PR, one tracker note per push) and reaches `main` through #3443. The children, in the ruling's order (`blockedBy` edges on the cards):

- **Fork 5 and the statute's override points** — the `deliveryAgent:` marker with a required `deliveryAgentReason:` is the one override; both process-wide variables retired; `routed` never overwritten; an override gets its own triple's supervision (`3840`).
- **Statute: `executed` is the vendor actually spawned**, and the record says when a Claude converge editor also edited the lane (`3848`, `blockedBy` `3840`).
- **Fork 2** — no path produces `other` or `self-fix`; the two G1 defaults removed (`3838`).
- **Fork 3, core** — the subject axis (work task type, role kind, review lens); the authoring roles stay on Claude and record their tier (`3845`).
- **Fork 3, review** — `review-dispatch` becomes a router caller (`3846`, `blockedBy` `3845`).
- **Fork 4, policy** — `unsizedCardPolicy`, `defaultSize` and `fixSizeSource` as one setting (`3843`).
- **Fork 4, fix path** — `fix` and `ci-heal` take the `fixSizeSource` chain (`3844`, `blockedBy` `3843`).
- **Fork 4, field** — a task's estimate field, distinct from points (`3839`).
- **Fork 4, prepare** — prepare authors the size or estimate (`3842`, `blockedBy` `3839`).
- **Fork 4, admission** — an unsized card is held and sent to prepare unless `default-size` is set (`3849`, `blockedBy` `3843`, `3839`, `3842`).

**Order with the sibling cards (#3801).** #3784 (turning supervision enforcement on) is `blockedBy` the statute and Fork 2, 3 and 5 children above and by the decision card on what satisfies a `full` route for a single-worker lane (`3850`). #3798 (the router header) stays independent.

**Not sliced here:** the subject key and positive control for `prepare`, `prepare-decision` and `investigate` (#3801 follow-up 4); until they are prepared those three stay on Claude. Follow-ups 1 to 3 of #3801 (the planner build, the configurable graduation policy, a stamp-required gate) are not this card's.

## Done when

What remains of the original Done-when after the ruling. Items 1 and 2 as first written are met by the build (`0f1d0fb8f`), except where the ruling reverses it: a `review` dispatch now routes (Fork 3), and the override is the marker, not the two variables (Fork 5). Those parts moved to the children.

1. **Executable** — every child listed above is `status: resolved`: `grep -L '^status: resolved' $(grep -l '^parent: "3717"' we:backlog/*.md)` prints nothing.
2. **Executable** — on the branch, `npx vitest run we:scripts/lib/__tests__/dispatch-task-type.test.mjs we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs` passes, and the generated routing table equals the one in `we:docs/agent/dispatcher-runbook.md`.
3. **Probed live** — one real `dispatch-lane` call records a routing decision and reasons in its run record, with `routed` and `executed` as the ruling defines them, and the checked-in table matches `node` output for that day's scorecards.
