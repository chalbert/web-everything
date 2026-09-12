---
bornAs: xe6nenk
kind: story
size: 5
parent: "3369"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/delivery-agent-brief.md", "we:docs/agent/prototype-based-dev.md", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-11"
tags: []
---

# Conveyor dispatch: give prototype-shaped backlog items their own live-exercise brief and graduation gate

Sibling of #3567 (kind: investigation), same gap one level over. Confirmed live 2026-09-11: the conveyor's normal build dispatch (we:scripts/operations/dispatch-lane.mjs's launchKind selection, we:skills-src/conveyor/delivery-agent-brief.md) has NO mechanism to tell a dispatched build agent this item is prototype-shaped -- new mechanical/dispatch infrastructure (a new provider, wrapper, or dispatch kind) that we:docs/agent/prototype-based-dev.md says must be proven via a real driver+observer live exercise (block to completion, backup-branch a partial-failure attempt, score a fixed checklist, never trust passing tests + clean review alone) before it replaces or extends a production path. Right now that discipline lives only in the doctrine doc and is applied by hand only when an interactive session remembers to hand-compose it -- every prototype proven this session (#3627's delivery wrapper, #3371's Codex isolation fix, the Antigravity probe) was proven this way, never through the conveyor's own tick loop. Recommended shape, mirroring #3567's own precedent (we:scripts/readiness/dispatch-plan.mjs already special-routes kind: decision and grouping kinds outside the plain build path): add a way to mark an item prototype-shaped on the kind axis and give we:scripts/operations/dispatch-lane.mjs a matching brief (parallel to we:skills-src/conveyor/delivery-agent-brief.md) that bakes in the park-until-genuinely-exercised rule, the driver+observer live-test pattern, the backup-branch-on-partial-failure step, and the checklist-scorecard report format from we:docs/agent/prototype-based-dev.md. OPEN FORK, flagged rather than decided silently (same fork #3567 resolved for investigation, may resolve differently here): a genuine new kind: prototype value on the kind axis, vs. a label/flag on the existing story kind that dispatch-lane branches on -- check whether a prototype-shaped item is ever ALSO grouping/epic-shaped or always a leaf story before deciding. Explicitly distinct from #3629 (open, proving the review/fix dispatch kinds' OWN graduation), which is about the dispatch machinery proving itself, not about routing ordinary prototype-shaped stories through conveyor build dispatch with the right brief.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
