---
bornAs: xeudj65
kind: story
size: 3
parent: "3925"
status: resolved
scaffoldedBy: "graduation-page-file"
dateScaffolded: "2026-09-22"
blockedBy: ["3926"]
scope: ["plateau:src/graduation/graduation-read.ts", "plateau:src/graduation/types.ts", "plateau:wip-relay.js", "plateau:scripts/wip-publish.ts", "plateau:vite.config.mts"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
graduatedTo: "plateau:src/graduation/graduation-read.ts"
tags: [delegation, graduation, operator-page]
---

# The laptop answers a graduation ask over the wip relay, with a dev route for local use

The agent graduation page gets its data the way /decide does: the page sends a read-only ask over the existing /wip relay socket and the laptop answers it. Add a closed `graduation` ask (no arguments) to `ASKS` in plateau:wip-relay.js, a handler in plateau:scripts/wip-publish.ts backed by a new plateau:src/graduation/graduation-read.ts that runs WE's `graduation-progress-report --json` and checks the schema-2 shape, the page-side types in plateau:src/graduation/types.ts, and a same-origin `GET /api/graduation` dev route in plateau:vite.config.mts so the page works locally where there is no relay.

## Notes

- Contract: `plateau:docs/graduation-page.md` → "Data contract" and "Transport". Types mirror it exactly.
- The read follows plateau:src/wip/wip-read.ts: injectable `exec`, 30 s timeout, parse the operation's
  `verdict`, reject anything that is not `schema: 2` with a clear error (the page shows it as the error state).
  Node-only; the browser imports the types file only.
- The relay change is one entry in `ASKS`; the existing bounded-JSON check covers the payload. Do not add a
  Worker route, secret or Durable Object table.
- The dev route caches one answer for 8 s, like `/api/wip`, and sends no CORS header.
- Contract dependency: `3926` defines schema 2. Tests use a fixture in that shape; the live smoke check
  (Done when 3) needs `3926` merged on WE `main`.

## Done when

1. **Executable** — `npx vitest run plateau:src/graduation` passes, with tests that fail before this lands: the
   read parses a schema-2 fixture, rejects a schema-1 verdict and a non-JSON stdout with a named error, and passes
   the WE root and `--json` to the injected exec.
2. **Executable** — `npx vitest run plateau:scripts/wip-relay.test.mjs` passes with a new case: an ask
   `{t:'ask', id, what:'graduation'}` validates, and `what:'graduation'` with any argument is refused.
3. **Observable** — with the dev server running, `curl -s localhost:<port>/api/graduation` returns JSON whose
   `schema` is 2 (needs `3926` on WE main).
4. **Clean gate** — `npx vitest run` passes in the lane.

## Delivered

Built on plateau-app PR #177 (`chalbert/plateau-app`, `lane/3927-graduation-ask`). Verified: the two targeted
test files plus the full `npx vitest run` (2241 tests) pass in that lane; a live curl of `GET /api/graduation`
on a throwaway dev server correctly rejects WE main's current (pre-`3926`) shape with the named schema error —
Done when 3's schema-2 response still needs `3926`/WE PR #2502 merged.
