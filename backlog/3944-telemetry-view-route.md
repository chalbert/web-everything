---
bornAs: xlt8y1j
kind: story
size: 3
parent: "3943"
status: open
blockedBy: ["3942"]
scope: ["plateau:src/telemetry/telemetry-view.ts", "plateau:src/telemetry/telemetry-view.css", "plateau:src/telemetry/telemetry-view.test.ts", "plateau:index.html", "plateau:src/main.ts"]
dateOpened: "2026-09-22"
tags: []
---

# plateau /telemetry view and route: every state from the mock, charts at container width, both themes

Ports plateau:docs/mocks/telemetry-page.html into the app as the /telemetry route (nav link beside Work in progress), rendering a TelemetrySnapshot plus a connection state: live, stale, never, loading, error, degraded, gap day, cache low, new week, hazard. Fed by a fixture source in this slice; the live transport is the next slice. Mobile first, two columns at 900px and wider, table views for every chart, escaped values.

## Done when

1. **Executable** — `npx vitest run plateau:src/telemetry/telemetry-view.test.ts` passes: one test per state in
   plateau:docs/telemetry-page.md's states table (11 rows) asserting the visible text that proves the state
   (e.g. "at least", "no data", "Not live", "No laptop has sent telemetry yet"), plus a hostile-string test (a label with
   `<img onerror>` renders inert).
2. `/telemetry` is a route with a nav link; opening it on the dev server with the fixture source shows the live state.
3. Playwright screenshots at 390px and 1100px, light and dark, for live, degraded, gap and stale are attached to the PR,
   with no horizontal scroll at 390px.
