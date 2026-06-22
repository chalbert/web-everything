---
kind: story
size: 8
parent: "1522"
locus: frontierui
status: resolved
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:tools/explorer/authRecipe.ts — --auth recipe (storageState + declarative steps, session-preserving reset)"
tags: []
---

# Explorer CLI: auth-gated reach — session setup recipe + session-preserving reset

Let the explorer reach logged-in states from the CLI: a pluggable setup recipe (form login / storageState / seeded cookies-localStorage) plus a reset strategy that survives client-only or in-memory sessions (the engine resets via goto = logout). Keystone for auditing the half of an app behind auth.

## Where / prototype

`fui:tools/explorer/playwrightDriver.ts` `seed()` resets via `page.goto(seedUrl)` — a full reload that drops plateau's in-memory session. The proof-of-concept harness `fui:tools/explorer/plateau-audit.ts` works around this by logging in once via the form, then navigating client-side through the app router (no reload) so the session survives. Productize that into the CLI: a setup hook (login script / `storageState` / seeded storage) + a reset mode that re-establishes the session instead of assuming `goto` is stateless.

## Resolved (2026-06-22) — `--auth <recipe>`, app-agnostic, two modes

Shipped a CLI auth recipe that keeps all app specifics in caller config, none in the tool (the `fui:tools/explorer/GOAL.md` charter). New `fui:tools/explorer/authRecipe.ts` defines an `AuthRecipe` with two general modes:

- **`storageState`** — a Playwright storage-state file (cookies + localStorage); applied at `browser.newContext({ storageState })` in `fui:tools/explorer/cli.ts`, so it survives the engine's `goto` resets for free. The right tool for token/cookie auth.
- **`steps`** — a declarative sequence (`goto` / `fill` / `click` / `waitFor` / `wait`) run on **every** `seed()`/reset, so an in-memory / SPA session a reload would drop is re-established each reset (session-preserving reset). `fui:tools/explorer/playwrightDriver.ts` `seed()` runs the steps INSTEAD of the bare `goto` when present.

Threaded `authSteps` through all three harnesses (`fui:tools/explorer/workbenchHarness.ts`, `fui:tools/explorer/docsSiteHarness.ts`, `fui:tools/explorer/gateRunner.ts`) to the driver; `--auth` flag + recipe load in the CLI.

**Validated live (in-memory/SPA hard case):** `node fui:tools/explorer/cli.ts -- http://localhost:4000/ --auth <recipe>` logged into plateau via the recipe and explored **8 authenticated states**, reporting `color-contrast` on logged-in pages (up to 56 nodes) — states the CLI could never previously reach. Unit tests for the step runner + relative-URL resolution (`fui:tools/explorer/__tests__/authRecipe.test.ts`); full explorer suite green (88). The `storageState` path is a thin pass-through to Playwright's own feature.

Remaining for a one-command full audit: whole-app route sweep #1524, `--out` report bundle #1525.
