---
kind: story
size: 3
status: open
dateOpened: "2026-09-28"
tags: []
---

# Health daemon: health-tick-overrun — we

What is wrong: Filing requests (#4079) are planned every health tick, but nothing schedules the lane-bound landing pass, so pending requests only land when an operator invokes we:scripts/operations/health-file-request-land.mjs by hand.

Product change: Register we:scripts/operations/health-file-request-land.mjs as its own recurring daemon-manifest entry (mirroring health-watch's own launchd plist), so pending filing requests land automatically on a cadence instead of requiring a manual invocation.

Next step: Add a health-file-request-land entry to we:skills-src/conveyor/daemon-manifest.mjs and a launchd plist example, following health-watch's own registration.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
