---
bornAs: xfxl484
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/lib/telemetry.mjs", "we:scripts/operations/telemetry-summary-io.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Cost tracking per daemon and per bot

Operator ask 2026-09-24. Attribute model spend (tokens and dollars) and gh API calls to the daemon or bot that caused them (review, fix-dispatch, dispatcher, stuck-PR inspector, health investigator), per day, readable in one command, so a runaway loop shows up as cost before it shows up as a stall. Reuses the telemetry core graduated in #3895.

## Done when

1. **Executable** — one command prints, per day, tokens, dollars and `gh` calls for each daemon and bot
   role; a test pins the attribution of a fixture session to its daemon.
2. **Live proof** — the command's numbers for one real day match the sum of that day's session usage.
