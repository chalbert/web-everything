---
kind: story
size: 3
parent: "1167"
locus: frontierui
status: resolved
blockedBy: ["1168"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/oracles/index.ts"
tags: []
---

# Layer-1 generic-invariants oracle bus for the autonomous UI tester

The always-on, script-free oracle layer for the autonomous UI tester (epic #1167, locus frontierui). Bolt a generic-invariant probe set onto every state the explorer (#1168) visits: no console errors, no unhandled promise rejections, no HTTP 5xx, no axe-core a11y violations, no broken/overflowing layout, no dead-end/stuck-focus, no crash — invariants that hold for any web app (Crawljax approach), working on a bare component AND a whole page. The a11y probe REUSES the existing #770 rendered-site axe lane, not a second axe integration. Layer-2 (conformance vectors) and Layer-3 (advisory LLM-judge) are deferred until #899 lands.

## Resolved (batch-2026-06-19) — pure oracle bus + 7 probes at `fui:tools/explorer/oracles/`

Built the Layer-1 oracle layer on the #1168 engine, same pure-core-over-injected-adapter shape (no browser launched — code + headless unit tests; dev-server-untouched rule held):

- **`fui:tools/explorer/oracles/observation.ts`** — the normalized per-state read (`Observation`: console errors, unhandled rejections, HTTP 5xx, axe violations, layout overflow, focus-trap, crash) + the `Finding`/`Oracle` contract.
- **`fui:tools/explorer/oracles/genericInvariants.ts`** — the seven app-agnostic probes (`no-crash`/`no-console-errors`/`no-unhandled-rejections`/`no-http-5xx`/`no-broken-layout`/`no-stuck-focus`/`no-a11y-violations`), each a PURE `Oracle`, plus the `OracleBus` that runs a selected set over each state and aggregates findings in a stable order. Severity split per epic default A + the #770 posture: crash/console/5xx/unhandled-rejection = `error` (hard, gate-blocking via `OracleBus.errors()`); a11y/layout/focus = `warn` (advisory ratchet).
- **`fui:tools/explorer/oracles/playwrightCollector.ts`** — the thin adapter building an `Observation` from a live page: accumulating console/pageerror/crash/5xx-response listeners, in-page layout-overflow + focus-trap probes, and the a11y read by REUSING the #770 axe lane (`@axe-core/playwright` + the shared `WCAG_TAGS` from `fui:tests/a11y/sitemap-routes.ts` — NOT a second axe integration). No tests of its own (the oracles are covered against synthetic observations).

Tests: `fui:tools/explorer/oracles/__tests__/genericInvariants.test.ts` (9 — each probe fires-on-violation/silent-when-clean, 5xx-not-4xx, severity split, bus aggregation order, `errors()` gate selection, custom subset, the full seven-probe roster). `tsc --noEmit` clean for all four modules; FUI `check:standards` green (0 errors). Layer-2/3 stay deferred (#899).
