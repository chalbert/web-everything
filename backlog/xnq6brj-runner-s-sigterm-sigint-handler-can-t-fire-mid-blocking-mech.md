---
kind: task
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-12"
tags: []
---

# runner's SIGTERM/SIGINT handler can't fire mid-blocking mechanical pass (plain execFileSync spawn blocks the event loop)

we:skills-src/conveyor/runner.mjs's new SIGTERM/SIGINT handler (built and tested today) releases the singleton lease cleanly and works correctly for the common case (idle / between-tick). But Node only dispatches signals on the event loop, so a SIGTERM that arrives while the runner is inside a blocking execFileSync call (one of its own mechanical passes) is not actually handled until that blocking child process returns. Narrow, documented-in-code limitation, not a regression. Precedent: #3404 already solved the identical problem for we:scripts/conveyor/verify-dispatch.mjs by moving its blocking pass onto runQuietHeartbeating instead of a plain blocking spawn. The same treatment likely applies here -- whichever of we:skills-src/conveyor/runner.mjs's own mechanical passes still use a plain blocking spawn should move to the same heartbeating pattern so a signal can be handled promptly even mid-pass.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
