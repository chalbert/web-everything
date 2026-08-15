---
bornAs: xfzdh6p
kind: story
size: 5
parent: "2676"
status: open
blockedBy: ["2726", "x7l22sz"]
dateOpened: "2026-07-26"
tags: []
---

# Generalize the rollup tree to N levels + a program/portfolio zoom above feature

The winning feature-tracking spine (a scale-first rollup tree) is level-agnostic. Generalize it to render tiers ABOVE feature — program → portfolio — with the same rollup/velocity/forecast, and add the higher zoom stop implied by the Constellation / Plateau Loop / Features breadcrumb.

The tree generalizes upward with zero new visual language — a higher tier is just another indent + rollup level. Open question: name the tier above feature — a PROGRAM (a delivery grouping of features, rolls up points) vs an INITIATIVE (a time-boxed bet) vs an OKR OBJECTIVE (an outcome the features serve, rolls up outcome-metrics not points). That choice decides whether the higher tier rolls up points or outcomes.

Spun off the **feature-tracking-screen** design session (design committee → red-team → refine loop) under epic #2676 (Plateau design-studio). Deferred for a later session. Committee decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d

## Preparation status (2026-08-15): NOT build-ready — two named blockers, verified against live code

Attempted per `we:agent-memory-src/story-preparation-checklist.md`. This card cannot be brought to
build-ready right now; recording why rather than forcing a design around either gap.

1. **The thing this story generalizes does not exist in the repo yet.** #2690 presupposes a built,
   rendering "rollup tree" to extend upward. Verified directly against `plateau-app` (not against backlog
   status alone): `plateau-app:src/feature-tracker/` contains only `plateau-app:src/feature-tracker/feature-tracking.webcases.ts`
   (the case spec) — no `plateau-app:src/feature-tracker/rollup.ts`, `plateau-app:src/feature-tracker/rollup.css`,
   or `plateau-app:src/feature-tracker/read-model.ts`. The component that would grow the new tier is
   unbuilt. Its story is **#2726 (S5 · epic→slice rollup with connector rails)**, `status: open`, itself
   `blockedBy: ["2725", "2691"]`; #2725 (S2 detail shell) is also `status: open`. Grepping every child of
   the ratified build epic **#2705** (18 slices) shows all 18 still `status: open` except the DEC (#2719,
   resolved) — only S0r has any code landed
   (`plateau-app:src/feature-tracker/feature-tracking.webcases.ts`, "flags only, no new render", confirmed
   by `git log --all -- '*feature-tracker*'` in both repos). One level deeper: the `kind: feature` tier
   itself — the thing directly BELOW what #2690 wants to add above — is only a ratified *decision* (#2691,
   resolved, `codifiedIn: we:docs/agent/backlog-workflow.md#feature-tier`); its *implementation* story,
   **#2998** ("implement the feature tier: kind:feature above epic..."), is still `status: open`. #2690 asks
   to add a rendering tier two levels above ground that hasn't been poured. Added `blockedBy: ["2726"]` —
   the direct dependency (the rollup component this story extends); #2726's own chain transitively covers
   #2725/#2721/#2998.
2. **A real, undecided design fork is embedded in the card body itself.** "Open question: name the tier
   above feature — a PROGRAM … vs an INITIATIVE … vs an OKR OBJECTIVE … That choice decides whether the
   higher tier rolls up points or outcomes" is not a detail to leave for the builder — per checklist item 4
   it must be named as its own decision, the same way the sibling **#2689** (configurable hierarchy levels)
   was already split out of this same design session instead of buried in a story. Split to
   **#x7l22sz** ("Name the tier above feature (rollup basis: points vs outcome-metrics)"), which also
   carries a recommendation (PROGRAM — reuses points/velocity/forecast verbatim; INITIATIVE/OKR OBJECTIVE
   both need a new non-points aggregation primitive that doesn't exist yet). Added `blockedBy: ["x7l22sz"]`.

**Not viable to prepare further (interfaces/tasks/Done-when) until both blockers clear**: the interface this
story would specify (what a program/portfolio node exposes to the rollup renderer) is exactly what fork 2
above decides, and the renderer it would extend is exactly what #2726 has not yet built. Preparing
interfaces/tasks now would be inventing a contract against code that doesn't exist — the failure mode the
checklist's #2803/#2351 examples warn against (reasoning from a state the repo hasn't reached). Re-open
preparation once #2726 lands and #x7l22sz ratifies.
