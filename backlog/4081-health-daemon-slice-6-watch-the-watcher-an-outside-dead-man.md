---
bornAs: xllcgox
kind: story
size: 2
parent: "4075"
status: open
blockedBy: ["4065", "4077", "4045"]
scope: ["we:scripts/operations/operator-queue.mjs"]
dateOpened: "2026-09-24"
tags: [health-daemon]
---

# Health daemon slice 6: watch the watcher — the outside check reads the last-tick-completed stamp

Sixth slice of 4065. Watching the watcher is already ruled (clause 6 of #resident-daemon-reload-lifecycle:
an outside check alerts when a daemon's heartbeat stops) and #4045 builds that check for every daemon. The
health process is one more daemon under it. This slice adds only what the skeptic round showed was missing:

- #4045's outside check reads the health process's **last-tick-completed stamp**, not only its lease
  heartbeat — the pass runner's heartbeat runs on an independent timer and keeps moving through a hung tick.
  (Worth adopting for every daemon; raised on #4045.)
- The operator queue's first line shows that stamp's age, so a dead watcher is visible where the operator
  already looks.

## Done when

1. **Executable** — a test with a frozen last-tick stamp and a fresh heartbeat makes the outside check
   alert; it fails before this lands.
2. **Live proof** — pausing the health tick on the running fleet raises the outside alert within 3 intervals.
