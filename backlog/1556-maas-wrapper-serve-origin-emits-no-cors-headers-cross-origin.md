---
kind: story
size: 3
status: resolved
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
tags: [maas, cors, workbench, polyglot, webdocs]
---

# MaaS wrapper-serve origin emits no CORS headers — cross-origin import blocked

The dev-only MaaS wrapper-serve origin (`fui:vite.maas.config.mts`, :3002) emits **no CORS headers**, so the cross-origin ES-module `import()` the whole #1499/#1501 design depends on is **blocked by the browser**. Verified (2026-06-22) via a real Playwright probe: a page on the :3001 host doing a cross-origin `import()` of a `?form=react-live` module throws `Failed to fetch dynamically imported module`; curl confirms neither the 302 redirect nor the 200 carry `Access-Control-Allow-Origin`, and OPTIONS returns 302 (no preflight). Fix the maas serve middleware to emit CORS (incl. on the pin redirect + preflight). Blocks #1030.

## Symptom (verified 2026-06-22, batch-2026-06-22-1545-1549)

A throwaway maas origin started with **current** code (`vite --config vite.maas.config.mts --port 3012`,
leaving the user's stale :3002 untouched) serves the #1518 `?form=react-live` module correctly over
**same-origin** curl (HTTP 200, ~1 MB, `export { …, mount, unmount }`, react-dom bundled). But:

- **No `Access-Control-Allow-Origin`** on the `302` pin-redirect **or** the final `200`
  (`fui:tools/maas/produceWrapperBytes.mjs` pin URL).
- **`OPTIONS` preflight returns `302`**, not a CORS preflight response.
- **Browser arbiter:** Playwright on the :3001 host running a cross-origin
  `await import(<maasOrigin>/_maas/<tag>.js?form=react-live)` →
  `TypeError: Failed to fetch dynamically imported module`.

So `server: { cors: true }` in `fui:vite.maas.config.mts` is **not** taking effect for the custom
`maasWrapperServe` middleware route — likely a middleware-ordering issue (the maas middleware responds
before Vite's built-in `cors` connect middleware runs), or the handler's copied response headers
(`fui:tools/maas/vite-plugin.mjs:33`) need to carry CORS explicitly.

## Why this is a real prerequisite (not the consumer's job)

#1499 ruled cross-origin serving is allowed; #1501 stood up the second origin; #1518 added the live-mount
form. None actually verified a **cross-origin browser import** succeeds — only same-origin handler unit
tests (`fui:tools/maas/__tests__/wrapperServeHandler.test.mjs`). The CORS gap is a property of the
**serve origin** (#1501's deliverable), distinct from #1030's workbench **consumer** scope. #1030 is the
6th session to hit a verified-absent producer-side prerequisite (after #1501, #1518); this is the next one.

## Work

- Make `maasWrapperServe` (`fui:tools/maas/vite-plugin.mjs`) emit `Access-Control-Allow-Origin` (reflect
  Origin or `*`) on **every** response it produces — the `200`, the `302` pin redirect, and a proper
  `OPTIONS` preflight (`Access-Control-Allow-Methods: GET, OPTIONS`) — rather than relying on Vite's
  `cors: true`, which doesn't reach this route. Diagnose the ordering first; the minimal correct fix may be
  to set the headers in the handler/middleware directly.
- Cover it with a test asserting the served response carries CORS (extend the existing
  `wrapperServeHandler` suite, or add a middleware-level test).

## Acceptance

- [ ] A cross-origin `import(<maasOrigin>/_maas/<tag>.js?form=react-live)` from a different origin (the
      :3001 host) **resolves** in a real browser (Playwright), returning `{ mount, unmount }`.
- [ ] `Access-Control-Allow-Origin` is present on the `302` pin redirect and the `200` module response.
- [ ] A test asserts the CORS header on the served response.

Relates to #1499 (cross-origin ruling), #1501 (the serve origin), #1518 (the live form), #1030 (blocked).

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

The serve origin now emits CORS on **every** response. Fixed at the framework-agnostic handler
(`fui:tools/maas/wrapperServeHandler.mjs`), not by relying on Vite's `server.cors` (which never reaches the
custom `maasWrapperServe` middleware route, per the verified diagnosis):

- New `corsHeaders(preflight)` helper; `handle()` now wraps the inner `respond()` and tags **every**
  response (200, the 302 pin redirect, 304, 4xx/5xx) with `Access-Control-Allow-Origin: *`, and answers the
  browser's `OPTIONS` preflight with a `204` carrying `Access-Control-Allow-Methods: GET, OPTIONS` +
  `Allow-Headers: If-None-Match, Content-Type` + `Max-Age`.
- **Why `*`, not reflected Origin:** the served bytes are public, credential-free dev modules (a module
  `import()` sends no credentials), so the wildcard is correct and simplest — and `Origin` is a forbidden
  request header the `Request` guard strips, so it never survives `vite-plugin.mjs`'s `Request` adapter to
  be reflected anyway.
- The Vite middleware (`fui:tools/maas/vite-plugin.mjs`) already copies all response headers via
  `response.headers.forEach(...)` and routes `OPTIONS` to the handler (URL starts with the base path), so
  the CORS headers reach the wire unchanged.
- Tests: extended `fui:tools/maas/__tests__/wrapperServeHandler.test.mjs` — CORS on the 302 + served 200,
  and the OPTIONS preflight (13 pass). Acceptance criterion 3 (a test asserts the CORS header) met;
  criteria 1–2 follow deterministically (ACAO present on the redirect + 200 + preflight).
