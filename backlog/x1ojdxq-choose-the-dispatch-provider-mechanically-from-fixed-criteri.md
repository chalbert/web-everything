---
kind: story
size: 5
priority: high
parent: "x4v2xe4"
status: open
relatedTo: ["3690", "3695", "3696", "3443", "3658", "x994927", "xn4cgvr"]
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/lib/__tests__/dispatch-task-type.test.mjs"]
dateOpened: "2026-09-19"
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
2. One shared wrapper `chooseProvider(dispatch, { override })`: load the scorecards at the IO edge, call `selectProvider` and `selectSupervisionLevel`, return `{ provider, level, taskType, reasons }`. Called by `dispatch-lane`, `review-dispatch`, `reconcile-fix-dispatch` and `dispatch-task` (#xn4cgvr) **before** the spawn.
3. **The run record stores both `routed` and `executed`.** A dispatch records the provider it actually used, so a silent fallback (routed `codex`, executed `claude`) is visible in the trial data instead of corrupting it.
4. **The override is an explicit, recorded input** at the call site (`--provider-override=<p> --override-reason=<text>`), stored in the run record. It is never a sentence in a brief telling an agent to "prefer" something.
5. **The criteria are written down where a human can audit them:** one table of `{dispatch kind → taskType → routing decision given today's scorecards}`, generated from the same pure functions and checked into `we:docs/agent/dispatcher-runbook.md`, with a test that fails when the checked-in table drifts from what the code produces. That table is also what makes a wrong route debuggable.
6. **The execute half depends on a provider port.** Until a Codex or Gemini provider port is on `main` (#3443, #3658), a non-Claude decision is recorded as `routed: codex, executed: claude`, and the table shows the gap. Then the brief's "you MAY delegate" sentence is replaced by the computed decision, and the harness, not the agent's word, supplies the provider in the completion record.

## Could a PreToolUse hook enforce it?

Only partly, and it is not the gate. A hook sees the command string, so it can require a routing flag on a `dispatch-lane` call or flag a raw `claude --bg` worker launch, but it cannot tell whether a decision was computed or typed. **The deterministic half is the operation itself refusing to spawn without a derived `taskType` and a recorded decision.** A warn-level `we:scripts/guard-bash.mjs` rule for a raw launch that bypassed the operation is an optional backstop, and it shares the follow-on named in #xn4cgvr.

## Flag for the operator: this encodes a graduation model nobody has ratified

The router implements #3690's progressive-backdown model, but #3690 is still an open decision. Wiring turns that model into a dispatch gate. If the operator's statement above is meant as the ruling, ratify #3690 so the thresholds are not running ahead of a ruling. Related, not duplicated: #3695 (keeping external capability ratings current, which feeds only the advisory `explorationHint`) and #3696 (making Antigravity the default recommendation, which changes the router's outputs and regenerates the table, not the wiring).

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/dispatch-task-type.test.mjs` passes; its cases fail before: each dispatch kind and cause in the table maps to the stated `taskType`; a `build` with all-docs scope maps to `doc-fix`; a conflict-caused `fix` maps to `conflict-resolution`; a `review` or `prepare` dispatch maps to no `taskType` and takes the role path; an unmappable dispatch is refused with a named reason; the generated routing table equals the checked-in one.
2. **Executable** — a dispatch test shows `routed` and `executed` both land in the run record, a mismatch is preserved, and an override appears with its reason.
3. **Probed live** — one real `dispatch-lane` call records a routing decision and reasons in its run record, and the checked-in table matches `node` output for today's scorecards.
