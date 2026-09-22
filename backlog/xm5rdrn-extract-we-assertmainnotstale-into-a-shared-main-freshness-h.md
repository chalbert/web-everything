---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/main-freshness.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Extract we:assertMainNotStale into a shared main-freshness helper

we:scripts/operations/review-dispatch.mjs is currently the ONLY conveyor script that self-checks main freshness before acting (assertMainNotStale, line 375). Extract it into a new shared we:scripts/lib/main-freshness.mjs helper that we:scripts/operations/review-dispatch.mjs calls the same way, so every daemon we:3860 and its siblings split the runner into (fix-dispatch, verify, the watchers) can call the SAME self-contained freshness check before acting, instead of depending on we:skills-src/conveyor/runner.mjs's own main-ref-sync ordering (today enforced only by running first in one process's pass list). This does not block any sibling daemon-extraction slice from landing (the audited passes are already safe under a bake period without it); it is what each slice's final cutover step (dropping a pass from we:skills-src/conveyor/runner.mjs's own list) should call before doing so. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
