---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-08-30"
tags: []
---

# No sandbox or fixture-repo way to validate a change to the dispatcher itself without running it against real backlog items and real PRs

#3383 own text names this risk directly ("even before any of its code has landed -- it is taking real actions against real PRs and real shared state") but no card addresses it. The epics own "still not done" list makes the gap concrete: the planned "live end-to-end test" is explicitly a scratch clone of the recovered branch plus "picking one specific low-stakes backlog item to actually dispatch" -- a real item, real PR, real shared state, chosen only for being low-stakes, not a synthetic fixture. we:skills-src/conveyor/runner.mjs and we:skills-src/conveyor/supervisor.mjs carry no dry-run/shadow/canary mode (grepped for dry-run, dryRun, canary, shadow mode -- none), and we:scripts/operations/dispatch-lane.mjs only guards against running FROM a lane checkout (assertNotALaneCheckout), not against dispatching AGAINST a non-production target repo/backlog. So every future change to the dispatcher machinery itself inherits the same choice: skip live validation, or validate against production. Checked the backlog for an existing sandbox/fixture-repo/staging-environment card scoped to the conveyor/dispatcher (grepped sandbox, "fixture repo", "scratch repo", "staging environment", "validate the dispatcher" across we:backlog/*.md and we:docs/agent/*.md) -- none found; the closest hits are all for unrelated subsystems (polyglot panel dry-run flags, workflow orchestrator dry-run, plateau-loop rewrite).

## Done when

1. A design is recorded for how a change to `we:skills-src/conveyor/runner.mjs`, `we:skills-src/conveyor/supervisor.mjs`, or `we:scripts/conveyor/tick-core.mjs` gets validated end-to-end before it touches production dispatch — a synthetic fixture repo/backlog the runner can be pointed at, a `--dry-run`/shadow mode that computes decisions without spawning agents, or an equivalent that does not require picking a real low-stakes backlog item as the test subject.
2. Capture-only is acceptable to close this card (a decision record with named forks, or a stated "not yet, here is the trigger" per the `#3049` shape) — no implementation is required, but the risk this epic's own text names ("even before any of its code has landed... it is taking real actions against real PRs and real shared state") must be answered rather than left as an accepted cost with no owner.
