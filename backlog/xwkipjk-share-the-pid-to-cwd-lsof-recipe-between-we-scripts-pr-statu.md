---
kind: task
status: open
scope: ["we:scripts/conveyor/", "we:scripts/lib/"]
relatedTo: ["3478"]
dateOpened: "2026-09-05"
tags: [conveyor, simplification]
---

# Share the pid-to-cwd lsof recipe between we:scripts/pr-status.mjs and we:scripts/conveyor/queue-work.mjs instead of two copies

Both we:scripts/pr-status.mjs's lane-liveness probe and #3478's we:scripts/conveyor/queue-work.mjs independently shell the same lsof -a -p <pid> -d cwd -Fn recipe and parse it the same way (find the line starting with n, slice off the prefix). Found by an adversarial /converge simplicity-lens review of #3478's diff (disposition: carve-out -- introduced, not worse than base, parallelizable). Extract a small shared helper (e.g. we:scripts/lib/pid-cwd.mjs exporting a pidCwd(pid) function) and have both call sites use it, with a regression test that both call sites still resolve a real pid's cwd the same way.

## Done when

1. **Executable** — a shared `pidCwd(pid)` helper exists in one place; both call sites import it (no
   duplicated `lsof -a -p <pid> -d cwd -Fn` shell-out + parse); existing tests for both call sites still
   pass.
