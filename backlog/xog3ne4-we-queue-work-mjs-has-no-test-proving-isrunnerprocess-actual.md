---
kind: task
status: open
scope: ["we:scripts/conveyor/"]
relatedTo: ["3478"]
dateOpened: "2026-09-05"
tags: []
---

# we:queue-work.mjs has no test proving isRunnerProcess actually rejects a near-collision command line

we:scripts/conveyor/queue-work.mjs's isRunnerProcess() docstring claims its fuller we:skills-src/conveyor/runner.mjs path match is 'harder to collide with by accident' than a bare filename match (#3478 review round 3, standards-conformance), but no test exercises an actual near-collision — a process whose argv merely contains that path substring as an argument, cwd path, or log-file name without actually running the runner script. Add a we:scripts/conveyor/__tests__/queue-work-core.test.mjs (or CLI-level) case that proves the claim rather than leaving it asserted only in prose.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
