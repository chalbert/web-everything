---
bornAs: x909kb7
kind: story
size: 3
status: open
blockedBy: ["3823", "3670"]
scope: ["we:scripts/conveyor/pr-watch.mjs", "we:scripts/wait-green.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Move pr-watch and wait-green onto the PR state feed

Follow-on to #3699 Fork 1(b): pr-watch and wait-green stop calling gh pr view on their own timer and read the snapshot from the PR state feed through we:scripts/lib/pr-state-snapshot.mjs. Each keeps its existing exit conditions (merged, closed, checks and review decision as it classifies them today). When the snapshot is missing or older than two poll intervals, the watcher falls back to polling for itself with random jitter, so a dead feed degrades to today's behavior and never blocks a watcher. Blocked by the feed story and by #3670 because all three touch we:scripts/conveyor/pr-watch.mjs and we:scripts/wait-green.mjs.

## Done when

1. **Executable** — `npx vitest run` on we:scripts/conveyor/__tests__/pr-watch.test.mjs and we:scripts/__tests__/wait-green.test.mjs passes with new cases that fail before this item lands: with a fresh snapshot the watcher makes zero `gh` calls and reaches the same merged, closed, ready-to-land and timeout outcomes it reaches today; with a missing or stale snapshot it polls for itself after a jittered delay and reaches the same outcomes.
