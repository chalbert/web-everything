---
kind: epic
parent: "3383"
status: open
dateOpened: "2026-09-22"
tags: []
---

# /telemetry page: Claude usage this week, cache health, output and machine load for the operator

An operator page in plateau-app, sibling of /wip, that answers: how much Claude usage this plan week and when it resets, where it went (model, who ran it), whether caching is healthy, what it produced, how loaded the laptop is, and whether the numbers can be trusted. Data is the laptop own telemetry: the claude-otel-collector day files and the host-sampler store and rollups. Design, states, wire shape and transport: plateau:docs/telemetry-page.md; mock plateau:docs/mocks/telemetry-page.html.

## Slices (in order)

1. xs0eutz — WE pure usage core (week, days by model, roles, cache, output).
2. xaxks4j — WE machine + sources core and the declared `telemetry-summary` operation (blockedBy 1).
3. x0lb6js — plateau types, validator, Node reader, dev `/api/telemetry` (contract only; parallel to 1–2).
4. xlt8y1j — plateau view + `/telemetry` route from the mock, fixture-fed (blockedBy 3).
5. x3izqob — plateau live data over the relay's ask channel + integrated sighted review (blockedBy 4).

Out of scope, owned elsewhere: per-agent live activity (/wip), model graduation and scorecards (the graduation
page), usage by task type (#3738), queue depth and dispatch rate (#3569), the collector's launchd repoint (#3739).

## Done when

1. **Executable** — every slice above is resolved, and on the laptop `node we:scripts/operations/run.mjs telemetry-summary --json`
   prints a snapshot that plateau's validator accepts, and the dev server's `GET /api/telemetry` answers 200 with it.
2. The deployed /telemetry page shows this week's usage from the laptop over the relay, and the stale state after the
   publisher stops.
