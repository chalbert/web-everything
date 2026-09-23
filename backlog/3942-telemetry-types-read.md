---
bornAs: x0lb6js
kind: story
size: 2
parent: "3943"
status: resolved
scope: ["plateau:src/telemetry/types.ts", "plateau:src/telemetry/telemetry-validate.ts", "plateau:src/telemetry/telemetry-read.ts", "plateau:src/telemetry/telemetry-validate.test.ts", "plateau:src/telemetry/telemetry-read.test.ts", "plateau:vite.config.mts"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
graduatedTo: "plateau:src/telemetry/telemetry-read.ts"
tags: []
---

# plateau /telemetry: TelemetrySnapshot types, payload validator, Node reader and the dev /api/telemetry route

The plateau-app side of the contract in plateau:docs/telemetry-page.md: the TelemetrySnapshot v1 types, a validator the page runs on every payload (closed shape, finite numbers, capped strings), a Node reader that runs the WE telemetry-summary operation the way wip-read runs runner-activity, and GET /api/telemetry on the dev server. Built against a fixture so it does not wait on the WE operation.

## Done when

1. **Executable** — from a plateau-app lane, `npx vitest run plateau:src/telemetry` passes (no such directory before this item).
2. The validator accepts the mock's snapshot (copied as a fixture) and refuses: an unknown top-level key, a non-finite
   number, a string over its cap, a wrong `v`, a `days` array over 8, an unknown source id.
3. The reader runs the WE operation with `execFile` (never a shell), returns `{ok:false, reason}` on a non-zero exit or
   invalid JSON, and is unit-tested with an injected exec.
4. `GET /api/telemetry` on the dev server answers 200 with a validated snapshot, 502 with a JSON reason otherwise; no CORS header.
