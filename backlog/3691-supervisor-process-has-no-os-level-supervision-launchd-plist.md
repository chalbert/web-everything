---
bornAs: xkpys3j
kind: decision
status: open
scope: ["we:skills-src/conveyor/com.we.conveyor-supervisor.plist.example", "we:skills-src/conveyor/supervisor.mjs", "we:scripts/conveyor/driver-watchdog.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Supervisor process has no OS-level supervision — launchd plist never installed

Confirmed live tonight (epic #3383): the conveyor's own supervisor process (we:skills-src/conveyor/supervisor.mjs) has NO OS-level supervision of itself. we:skills-src/conveyor/com.we.conveyor-supervisor.plist.example is a ready-made launchd agent plist template, but it was never installed to ~/Library/LaunchAgents/ — so if the supervisor process itself crashes (not merely its child driver going stale or exiting, an actual death of the supervisor), nothing restarts it and nothing alerts anyone. we:scripts/conveyor/driver-watchdog.mjs (just fixed the same night to alert on a fully-down DRIVER) has no reach here either — it watches the driver's own lease/queue signals from inside a driver checkout, and assumes a supervisor is there to relaunch it; it cannot notice its own supervisor's death. This is a second, distinct gap from the driver-down alert fix: there is no watchdog-of-the-watchdog. Options for the operator to weigh when back: (1) actually install the existing launchd plist for real OS-level supervision (KeepAlive), (2) build a separate lightweight meta-watchdog process, or (3) explicitly accept the residual risk and document why. Filed as a decision, not auto-actioned — do NOT install the plist without the operator's call.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
