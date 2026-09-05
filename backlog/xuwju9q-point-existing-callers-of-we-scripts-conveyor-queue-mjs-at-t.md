---
kind: task
status: open
scope: ["we:scripts/conveyor/", "we:.claude/skills/conveyor/"]
relatedTo: ["3478"]
dateOpened: "2026-09-05"
tags: [conveyor]
---

# Point existing callers of we:scripts/conveyor/queue.mjs at the checkout-aware we:scripts/conveyor/queue-work.mjs

WE #3478 added we:scripts/conveyor/queue-work.mjs, a checkout-aware entry point that refuses rather than guesses which checkout's we:.conveyor/queue.json sidecar to write. It deliberately left the existing we:scripts/conveyor/queue.mjs untouched (cwd-relative resolution, no refusal) rather than change its behavior for existing callers -- an implementation call #3478's own text left open. Found by an adversarial /converge red-team simplicity-lens review of #3478's diff (disposition: carve-out -- introduced, not worse than base since we:scripts/conveyor/queue.mjs's own behavior is unchanged from before #3478, parallelizable): as long as any skill, script, doc, or human habit still invokes we:scripts/conveyor/queue.mjs directly, it reproduces the exact silent-wrong-checkout failure #3478 was filed to eliminate, just via the old entry point instead of the new one. Proposed direction: point known callers (the we:.claude/skills/conveyor operator instructions, docs) at we:scripts/conveyor/queue-work.mjs, and/or add a deterministic check flagging any skill/script/doc that still shells out to we:scripts/conveyor/queue.mjs directly.

## Done when

1. **Executable** — either every known caller (skill docs, operator instructions) of `we:scripts/conveyor/queue.mjs`
   is updated to call `we:scripts/conveyor/queue-work.mjs` instead, or a deterministic check fails when a
   skill/script/doc adds a new direct shell-out to `we:scripts/conveyor/queue.mjs`.
