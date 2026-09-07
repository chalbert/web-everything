---
bornAs: x7nvaq0
kind: story
size: 3
parent: "3559"
status: open
scope: ["we:skills-src/capability-search/SKILL.md"]
relatedTo: ["3593"]
dateOpened: "2026-09-07"
tags: []
---

# Extend capability-search doctrine: check whether a mechanical pass already handles a main-session action before hand-running it

Narrower follow-on to we:backlog/3559-search-operations-skills-and-the-backlog-before-proposing-or.md (status: resolved, shipped as we:scripts/capability-search.mjs), filed under we:backlog/3593-catch-and-correct-agent-instruction-slips-mechanically-a-syn.md because it surfaced from the same night's instruction-slip catches. #3559's own scope is "does an operation/skill/backlog item for this concept already exist" - a proposal-time / build-time check. It is a genuinely different, narrower question from what this item names: whether a MAIN-SESSION action the operator or a driving session is ABOUT TO TAKE is redundant because a mechanical/conveyor pass already performs it on its own cadence. Concrete example from tonight: a session manually dispatched we:scripts/operations/review-dispatch.mjs by hand for a PR, when the conveyor runner's own reconcile pass (we:skills-src/conveyor/runner.mjs's makeCliMechanicalPasses, which shells we:scripts/conveyor/reconcile-fix-dispatch.mjs and the review-reconcile pass every tick) already covers that exact PR on its own schedule - the manual dispatch was not wrong to run, but nobody checked first whether it was already going to happen without the intervention.

#3559's own "Open question" section already flags a version of this same shape (fork (b): whether capability-search should be "wired as a referenced step other build-dispatch briefs are expected to follow") but explicitly declined to resolve it, reasoning that "neither miss above happened inside a dispatched build" so a dispatch-brief gate would not have caught either cited instance - and left it for a fresh miss to justify. This item is that fresh miss, and it is specifically about MAIN-SESSION/orchestrator actions (the mechanical-delivery-doctrine's own "orchestrating session" role), not dispatched-build briefs - a distinct surface from the one #3559's fork (b) was weighing.

Scope: extend we:skills-src/capability-search/SKILL.md (or the mechanical-delivery-doctrine skill it is cited alongside) with an explicit check - before a main/orchestrating session hand-runs an operation that a mechanical pass already performs on a cadence (e.g. review-dispatch, reconcile-fix-dispatch, the drain's own sweep), check whether that pass already covers the same target and is due to run soon, and prefer waiting or letting the mechanical layer handle it over a redundant manual call. This rides the same underlying we:scripts/capability-search.mjs tool fork (b) already names, but is scoped to the orchestrator's own action-taking rather than a dispatched agent's build/proposal habits, so it is filed as its own explicit item rather than folded silently into #3559's already-resolved scope.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
