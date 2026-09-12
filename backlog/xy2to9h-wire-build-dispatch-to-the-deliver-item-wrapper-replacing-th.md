---
kind: story
size: 5
parent: "x54akv4"
status: open
relatedTo: ["3627", "3628"]
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/delivery-agent-brief.md", "we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-12"
tags: []
---

# Wire build dispatch to the deliver-item wrapper, replacing the agent-driven lifecycle brief

Per the 2026-09-12 delegation audit on we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md, build is one of six unwired dispatch launch kinds: the dispatched agent still runs its own lifecycle (lane-pool acquire, open-pr, learnings-drop) out of we:skills-src/conveyor/delivery-agent-brief.md, a full prose brief, instead of a mechanical harness. we:scripts/operations/deliver-item-wrapper.mjs already EXISTS as a design sketch/prototype (built + amended under #3627, 2026-09-09) implementing exactly this: acquireLane -> claimItem -> spawn a minimal delivery agent in the foreground (no --bg, blocking-call-as-completion-signal) -> runGateWithOneRetry -> runConverge -> decideParkMode -> openPr -> dropLearning. It is not imported by anything and not wired into we:scripts/operations/dispatch-lane.mjs own build spawn path -- this item is that wiring, following the review kind (we:scripts/operations/review-dispatch-wrapper.mjs, already wired as the default path at we:scripts/operations/review-dispatch.mjs, lines 496/542) as the proven template. Cites #3627 (the design this wrapper implements) as context, not superseded. Per we:docs/agent/prototype-based-dev.md, this new dispatch infrastructure must be proven via a real driver+observer live exercise before it replaces the production build path -- park until genuinely exercised, do not trust passing tests alone. Once wired, we:scripts/guard-bash.mjs lifecycle denylist can finally be armed for build (today verification-only, correctly, since arming it before wiring would deny brief step 1 itself). Restart-survival note: see the parent epics own cross-cutting acceptance criterion -- the wrapper foreground-blocks on its delivery-agent spawn, the opposite shape from every other kind todays detached --bg dispatch uses to survive a runner restart; this item must resolve whether that blocking call runs inside the long-lived runner process (restart-unsafe) or a separate restartable per-dispatch process (restart-safe) before it is considered done.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
2. **Restart-survival preserved** — a runner restart mid-dispatch must not lose or corrupt work this wrapper
   is mid-executing (see the parent epic's own cross-cutting acceptance criterion, 2026-09-12).
