---
kind: story
locus: plateau-app
size: 2
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: [plateau-app, tooling, vitest, test-infra, gate]
---

# Install + configure vitest in plateau-app so its npm test gate runs

plateau-app declares `"test": "vitest run"` and ships colocated `*.test.ts` suites
(`plateau:technical-configurator/compat.test.ts` + `plateau:nl-provider.test.ts`, `plateau:platform-manager/aggregator.test.ts`,
`plateau:compatibility-map/compute.test.ts`), but **vitest is not a dependency** — `npm test` fails with
`vitest: command not found`, so none of those suites have ever run and the repo's unit gate is inert.
This is also the **cross-locus batch gate** for every plateau-app backlog item (`/batch` runs `npm test`
in plateau-app at close-out), so today those items can only be verified out-of-band (tsc + ad-hoc esbuild
runs, as #502/#339 were). Make the declared gate real.

## Tasks

1. Add `vitest` (+ `happy-dom` or `jsdom` for the DOM-touching suites) to plateau-app devDependencies and
   `npm install`.
2. Add a `we:vitest.config.ts` (or `test` block in `vite.config.mts`) with the DOM environment and the `@we/*`
   aliases the suites need (mirror `vite.config.mts`'s `resolve.alias` so a test importing `@we/blocks`/`@we/plugs`
   resolves), and a `.css` handling so CSS-importing modules load under test.
3. Confirm `npm test` runs green across the existing suites; fix any that were silently broken while unrun.

## Acceptance

- `npm test` (vitest run) executes in plateau-app and the existing suites pass.
- A fresh `/batch` of a plateau-app item can run its close-out gate (`npm test`) for real.

## Context

Surfaced at the close-out of `batch-2026-06-13` (#502 + #339), where the plateau-app locus gate could not
run and correctness was verified via `tsc --noEmit` + esbuild-bundled engine runs instead. Distinct from
the resolved #168 (legacy `plateau` repo e2e harness) and #277 (porting droplist tests to Frontier UI).

## Progress (resolved 2026-06-14)

- Added `vitest@4` + `happy-dom@20` to plateau-app devDependencies (`npm install`).
- Added `we:vitest.config.ts`: `environment: 'happy-dom'` (platform-manager modules under test touch the DOM),
  `include: ['src/**/*.test.ts']`, the `@we/plugs` + `@we/blocks` aliases mirrored from `vite.config.mts`,
  and the same JSX esbuild settings so `@we/blocks/renderers/jsx`-injected modules transform under test.
  CSS imports left unprocessed (vitest default → empty module), which is correct for unit tests.
- `npm test` (`vitest run`) now green: **7 files / 61 tests passing**. The plateau-app `/batch` close-out
  gate runs for real — no more tsc+esbuild out-of-band verification.
