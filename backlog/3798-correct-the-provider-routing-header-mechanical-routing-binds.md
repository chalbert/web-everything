---
bornAs: xhbc67b
kind: story
size: 1
parent: "3383"
status: resolved
relatedTo: ["3690", "3784", "3717"]
scope: ["we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-21"
dateResolved: "2026-09-21"
tags: []
---

# Correct the provider-routing header: mechanical routing binds the mechanical dispatch path only

Correct one paragraph in the header of we:scripts/lib/provider-routing.mjs: it still says the router serves interactive Claude Code sessions, but the ratified decision #3690 (Fork 4) says mechanical routing binds the mechanical dispatch path only. Nothing tracks the header correction. Small, mechanical.

## FOUND (2026-09-21)

- **The header overreaches.** Lines 4 to 7 of we:scripts/lib/provider-routing.mjs say the router provides "shared routing intelligence ... across both interactive Claude Code sessions (as a pre-dispatch check before picking a subagent) and autonomous conveyor/runner dispatch machinery". The first 60 lines are identical on main and on `origin/lane/mechanical-dispatcher`.
- **The ratified rule.** The statute `we:docs/agent/platform-decisions.md#delegation-trial-record-graduation`, "Reach": "Mechanical provider routing binds the mechanical dispatch path only. An interactive orchestrating loop keeps its own inline routing verdict ... the router may inform that verdict, never replace it." #3690 is resolved (2026-09-21) and its Fork 4 says the router's header claim over interactive sessions is corrected.
- **Not tracked.** No open card names the header correction.
- **The related comment rewording is already tracked.** The prototype-branch comments that still say "#3690 is not ratified" (in we:scripts/lib/dispatch-contracts.mjs and we:scripts/operations/dispatch-lane.mjs) are covered by #3784, whose FOUND section says they must be reworded and whose Done-when greps for them. A dated finding on #3784 lists the exact lines; this card does not repeat that work.

## DESIGN TO SETTLE

1. **The wording.** Say the router serves the mechanical dispatch path, and that an interactive session may read its verdict as input to its own inline routing (the model-routing and effort-routing rules) but is not bound by it.
2. **Other claims of the same kind.** Check the module's other prose and `we:docs/agent/backlog-workflow.md#model-routing` for the same overreach, and fix only what says "binds interactive".

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/provider-routing.test.mjs` passes, with a new case that reads the module's own header comment and asserts it says the reach is "the mechanical dispatch path only" and no longer says the router serves "both interactive Claude Code sessions". The case fails today: the header makes the interactive claim and never states the reach.
2. **Observable** — the header's wording matches the "Reach" rule in `we:docs/agent/platform-decisions.md#delegation-trial-record-graduation` (reviewer reads both).
