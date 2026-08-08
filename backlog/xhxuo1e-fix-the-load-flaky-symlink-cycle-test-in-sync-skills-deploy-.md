---
kind: task
status: resolved
dateOpened: "2026-08-08"
dateResolved: "2026-08-08"
tags: []
---

# Fix the load-flaky symlink-cycle test in sync-skills-deploy - its child-process bound trips under a full parallel run

The blocker-2 test in we:scripts/__tests__/sync-skills-deploy.test.mjs (symlink cycle fails fast, bounded via a child process) passes alone but flaked red twice consecutively on 2026-08-08 under the full 298-suite parallel verify-lane run: the child process is SIGTERM-killed by its own time bound under load, so expect(err.signal).toBeNull() sees SIGTERM. It reds the whole lane gate for unrelated changes. Widen the bound or serialize the suite so the gate only fails on the real hang it guards.
