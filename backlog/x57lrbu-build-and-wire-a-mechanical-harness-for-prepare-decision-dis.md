---
kind: story
size: 5
parent: "x54akv4"
status: open
relatedTo: ["3628"]
scope: ["we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/prepare-decision-agent-brief.md", "we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-12"
tags: []
---

# Build and wire a mechanical harness for prepare-decision dispatch

Per the 2026-09-12 delegation audit on we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md, prepare-decision is one of six unwired dispatch launch kinds, with NO existing wrapper at all -- no we:scripts/operations equivalent of we:scripts/operations/deliver-item-wrapper.mjs has been written for this kind. The dispatched prepare-decision agent still runs its own full lifecycle (lane-pool acquire, research + author forks, set preparedDate, open-pr) out of its own prose brief, we:skills-src/conveyor/prepare-decision-agent-brief.md. No prior design/decision card exists specifically proposing a prepare-decision wrapper shape (unlike build -> #3627 and fix -> #3629); this item may need a small design decision of its own during build (which of we:scripts/operations/deliver-item-wrapper.mjs own pieces -- acquireLane, runGateWithOneRetry, openPr -- generalize directly, and whether a prepare-decision report needs its own outcome enum distinct from builds done/blocked/needs-human-judgment shape given it never edits code, only authors research + forks), or may simply follow the same pattern build/fix/review already established -- use judgment during build rather than treating this as a prerequisite design task. Per we:docs/agent/prototype-based-dev.md, park until genuinely exercised via a real driver+observer live test before this replaces the production prepare-decision path. Restart-survival note: see the parent epics own cross-cutting acceptance criterion -- whichever shape this wrapper takes, it must not introduce a long synchronous/blocking step inside the long-lived runner process that a runner restart would lose or corrupt; verify this explicitly before considering the item done.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
2. **Restart-survival preserved** — a runner restart mid-dispatch must not lose or corrupt work this wrapper
   is mid-executing (see the parent epic's own cross-cutting acceptance criterion, 2026-09-12).
