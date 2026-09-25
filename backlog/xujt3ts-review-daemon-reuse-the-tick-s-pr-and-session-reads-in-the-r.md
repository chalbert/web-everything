---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/review-round-tag.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:skills-src/conveyor/review-daemon.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Review daemon: reuse the tick's PR and session reads in the reaper and tag helpers instead of re-listing per PR

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Findings R2, R3 (batch it, plus change detection). we:scripts/conveyor/session-reaper.mjs line 668 lists every agent session each tick: 1,222 to 1,601 sessions scanned per tick in the live log, with no change detection. we:scripts/conveyor/review-round-tag.mjs lines 52-61 and we:scripts/conveyor/review-status-tag.mjs lines 94-110 re-read labels with gh pr view and re-run claude agents --json per PR, although we:scripts/conveyor/reconcile-pass.mjs already read both once (lines 78-100, 120). Fix shape: pass the tick's snapshot into the helpers; reap only sessions whose state changed since the last tick, with a full sweep every N ticks. Done when: tests prove one listing per tick; LIVE proof: gh and claude child-process counts per tick before/after from a traced tick, in the PR.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
