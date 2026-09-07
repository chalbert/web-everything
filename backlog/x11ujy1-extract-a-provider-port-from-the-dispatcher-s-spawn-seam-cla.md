---
kind: story
size: 3
parent: "x6jk877"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/explore-io.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Extract a provider port from the dispatcher's spawn seam (Claude the only implementation)

Leverage-first first slice of the new dispatcher-decoupling epic (parent), mirroring #3370's already-filed extraction for the judge seam but applied to we:scripts/operations/dispatch-lane-io.mjs and we:scripts/operations/explore-io.mjs. Both already inject a spawn function for testing today: we:scripts/operations/dispatch-lane-io.mjs's createDispatchSinks takes an injectable spawnAgent (default defaultSpawnAgent, which does exec('claude', argv, {...})), and we:scripts/operations/explore-io.mjs's panelist spawn takes the same shape. Name that seam as a real provider port with a stable request/handle shape independent of any one CLI's argv or output parsing -- buildAgentArgv's Claude-specific flag construction ('--bg', '--session-id', '-n', '--append-system-prompt-file', or the '--resume'-only branch per #xu2krte's measured single-flag constraint) and parseBackgroundedId's Claude-specific stdout parsing stay exactly where they are; this item only names what sits between them and the sink/panelist spawn call site. No behaviour change -- every existing test in we:scripts/operations/__tests__/dispatch-lane-io.test.mjs and we:scripts/operations/__tests__/explore-io.test.mjs passes unmodified or is touched only for the mechanical rename, the same bar #3370 set for itself. NOT blocked on #3331/#3366/#3367 (the Claude-only liveness/resume hardening) landing first -- this is a pure refactor over an existing injection seam, so it can and should land regardless of that hardening's own timeline, exactly as #3370's own card argues for the analogous judge-seam extraction.

## Done when

1. **Executable** — a test constructs `createDispatchSinks` (and the we:scripts/operations/explore-io.mjs
   panelist spawner) with a hand-written fake implementing the PORT shape (not the existing CLI-argv-shaped
   stub) and asserts it is accepted and driven the same way the real spawner is. It must fail against `main`,
   because no such port-shaped contract exists to satisfy today — only a `claude`-argv-shaped stub does.
2. **The port is named and documented as a boundary**, not just an inferred function signature: what a
   provider implementation receives (item/session identity, the filled brief text, expected-duration hint) and
   what it must return (a durable handle string usable for later liveness polling), independent of any CLI's
   argv or stdout format.
3. **`defaultSpawnAgent` and `buildAgentArgv` become ONE implementation of the port**, not the port itself.
   Their Claude-specific argv construction and `parseBackgroundedId`'s stdout parsing stay exactly where they
   are — this item does not touch what they do, only what sits between them and the sink/panelist call site.
4. **No behavioural change** — every existing test in we:scripts/operations/__tests__/dispatch-lane-io.test.mjs
   and we:scripts/operations/__tests__/explore-io.test.mjs passes unmodified, or is touched only where the
   port extraction requires a mechanical rename.
5. **Explicitly out of scope**: a second provider implementation (that is the epic's later step, blocked on
   #3371's probe verdict), and we:skills-src/inspect-agent-health/agent-health.mjs's transcript format (a
   separate, harder adapter problem the epic names explicitly rather than folding in here).
