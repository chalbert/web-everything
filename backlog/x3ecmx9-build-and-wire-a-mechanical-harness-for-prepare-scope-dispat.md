---
kind: story
size: 5
parent: "x54akv4"
status: open
relatedTo: ["3628"]
scope: ["we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/prepare-scope-agent-brief.md", "we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-12"
tags: []
---

# Build and wire a mechanical harness for prepare (scope) dispatch

Per the 2026-09-12 delegation audit on we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md, prepare (scope) is one of six unwired dispatch launch kinds, and unlike build/fix it has NO existing wrapper at all -- no we:scripts/operations equivalent of we:scripts/operations/deliver-item-wrapper.mjs has been written for this kind. The dispatched prepare agent still runs its own full lifecycle (lane-pool acquire, author scope:, open-pr) out of its own prose brief. No prior design/decision card exists specifically proposing a prepare wrapper shape (unlike build -> #3627 and fix -> #3629); this item may need a small design decision of its own during build (which pieces of we:scripts/operations/deliver-item-wrapper.mjs -- acquireLane, runGateWithOneRetry, openPr -- generalize directly vs. need a prepare-specific branch), or may simply follow the same pattern build/fix/review already established -- use judgment during build rather than treating this as a prerequisite design task. we:scripts/operations/review-dispatch-wrapper.mjs (wired, fully mechanical, no agent spawn at all in its critical path) is a second template worth checking against: prepare-scope authors a small, mostly-mechanical scope: field prediction (the successful #3412 live-fire dispatch, cited in #3383, proves this concretely -- a real prepare-scope run predicted scope: and opened a PR unattended), which may make the review wrappers zero-agent-turn shape a better fit than builds foreground-agent-spawn shape; this item should check that concretely rather than assume. Per we:docs/agent/prototype-based-dev.md, park until genuinely exercised via a real driver+observer live test before this replaces the production prepare path. Restart-survival note: see the parent epics own cross-cutting acceptance criterion -- whichever shape this wrapper takes (agent-spawning like build/fix, or zero-agent-turn like review), it must not introduce a long synchronous/blocking step inside the long-lived runner process that a runner restart would lose or corrupt; verify this explicitly before considering the item done.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
2. **Restart-survival preserved** — a runner restart mid-dispatch must not lose or corrupt work this wrapper
   is mid-executing (see the parent epic's own cross-cutting acceptance criterion, 2026-09-12).
