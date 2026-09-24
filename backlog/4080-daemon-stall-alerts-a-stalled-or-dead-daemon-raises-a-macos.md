---
bornAs: xag0rnz
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["4065", "4077"]
scope: ["we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-notify.mjs"]
dateOpened: "2026-09-24"
tags: [health-daemon]
---

# Daemon stall alerts: a stalled or dead daemon raises a macOS notification within one probe interval

2026-09-24: daemons sat stalled for long stretches with owed work and nobody knew until a session looked.
The health process (4065 Fork 4) sends the OS notification **itself**, under its own once-per-episode
state, when a high-severity episode opens — first for "daemon stalled with owed work" and "daemon down". It
does not go through we:scripts/operations/operator-notify.mjs, because the dispatcher runs that pass and so
could never announce its own stall; it may reuse that module's checked delivery step (a failure to deliver
is surfaced, never swallowed). One notification per episode open, one reminder after 4 h if unacknowledged.
Off during `shadow` until the operator turns notifications on.

## Done when

1. **Executable** — a test proves one notification per episode open, one 4 h reminder, none for low
   severity, and none in `shadow`.
2. **Live proof** — stopping a test daemon on the running fleet produces one macOS notification within one
   probe interval of its episode opening.
