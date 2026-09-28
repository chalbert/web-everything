---
bornAs: xo9fynf
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/hung-session.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Extract a shared transcript-tail last-activity primitive (dedupe we:scripts/conveyor/session-reaper.mjs and we:scripts/conveyor/hung-session.mjs)

we:scripts/conveyor/session-reaper.mjs#resolveLastActivityMs (added by #4306) is a third near-duplicate of the tail-read + newest-entry-timestamp logic already in we:scripts/conveyor/hung-session.mjs's readIdleFinishedInfo and readHungInfo. Extract one shared low-level primitive (bounded transcript tail read -> newest parseable entry timestamp, with an mtime fallback) that all three call, so a future fix to the tail-parsing/mtime-fallback logic needs applying in one place, not three. Independent panel review finding from #4306's own converge pass (simplicity lens, carve-out: introduced, worse-than-base, parallelizable -- cosmetic impact if unfixed). Done when: one shared exported helper exists in we:scripts/conveyor/hung-session.mjs, we:scripts/conveyor/session-reaper.mjs#resolveLastActivityMs and we:scripts/conveyor/hung-session.mjs#readHungInfo/#readIdleFinishedInfo all call it (no behavior change), and each of the three call sites' existing tests still pass unchanged.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
