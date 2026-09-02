---
bornAs: x2respm
kind: story
size: 3
parent: "3383"
status: open
blockedBy: ["3443"]
dateOpened: "2026-08-30"
tags: []
---

# Conveyor supervisor has no reload lifecycle — only crash-restart, never a deliberate pick-up-new-code path

we:skills-src/conveyor/supervisor.mjs (built this epic, still unlanded on lane/mechanical-dispatcher) only handles two events: a child crash (restart with backoff) and SIGINT/SIGTERM (forward to the child, then exit). Neither path lets a running supervisor+runner pair pick up new code without a human finding and killing the process by hand — exactly the residency gap #2468/#2501 already solved for the sibling drain daemon (self-update-then-reload via clean-exit + launchd KeepAlive relaunch, ratified 2026-07-27). Nothing extends that ratified pattern to this newer resident process.

**Landing-order note:** we:skills-src/conveyor/supervisor.mjs does not exist on `main` yet — it lives only on `origin/lane/mechanical-dispatcher`. Check #3383's own "what's still not done" list for that branch's current landing status before designing against this file; its shape may shift before it merges. Recorded mechanically via `blockedBy: ["3443"]` (graduation of that branch) so the dispatcher's readiness engine excludes this item until #3443 resolves — do not re-dispatch before then.

## Done when

1. A design is recorded — in this card or a follow-on decision — for how a running we:skills-src/conveyor/supervisor.mjs picks up new code on a lane that lands a change to itself, without a human finding and killing the process by hand. The #2501 pattern (clean-exit + `KeepAlive` relaunch, self-update via a dedicated clone) is the concrete precedent to evaluate, not necessarily the answer: the conveyor supervisor's own header already argues it should stay "deliberately narrow" compared to the drain daemon, so the design must say why that narrowness does or doesn't extend to reload.
2. If a reload primitive is built, it is unit-tested the way `runSupervisorLoop`'s crash/backoff path already is (we:skills-src/conveyor/__tests__/supervisor.test.mjs) — an injected effect, no real process spawn in the test.
