---
kind: epic
status: open
locus: frontierui
dateOpened: "2026-06-22"
tags: [fui-devtool, exploratory-testing, autonomous-agent, a11y]
relatedReport: reports/2026-06-22-plateau-app-explorer-a11y-audit.md
---

# Explorer CLI autonomy — find every issue unattended from the CLI

Drive `fui:tools/explorer/cli.ts` toward the north star: point it at a real app and have it find ALL the issues on its own, unattended, with no bespoke harness. Builds on the shipped engine (epic #1167 — `fui:tools/explorer/`), which delivered the walk + Layer-1 oracles as a library plus a thin CLI; this epic closes the gap between "the engine has the primitives" and "the CLI autonomously produces a full audit."

## Grounding — the 2026-06-22 plateau-app audit ([we:reports/2026-06-22-plateau-app-explorer-a11y-audit.md](../reports/2026-06-22-plateau-app-explorer-a11y-audit.md))

Auditing plateau-app surfaced a real gap between the CLI and "find everything." The CLI surface is just `<url> --site --gate --max-states --max-depth --json` — so to audit all 30 routes (10 public + 20 behind login) I had to write a bespoke harness (`fui:tools/explorer/plateau-audit.ts`) that the CLI couldn't replace. Each thing the harness had to do that the CLI can't is a child below. The harness is the proof-of-concept for these slices.

## Captured gaps (children)

- **#1530 — silent under-reporting** (highest priority): the CLI reports "No Layer-1 findings" on pages with *known* axe violations (it found 0 on plateau `/home`, which has 5 color-contrast failures) — it observes states before they settle and swallows axe errors to `[]`. The tool must not silently miss issues that are present.
- **#1523 — auth-gated reach** (keystone): the CLI can't reach logged-in states. ~⅔ of plateau is behind a sign-in, and the engine resets via `goto` (which logs an in-memory/SPA session out). Needs a setup recipe + session-preserving reset.
- **#1524 — whole-app sweep by arbitrary base URL**: `sweepSite` is tuned to the WE/FUI docs site + hardcoded probe bases (`:3001/:8082/:8080`); crawling an arbitrary app (plateau on `:4000`) by base URL isn't a first-class CLI mode.
- **#1525 — actionable audit artifact**: the CLI prints to stdout and the a11y oracle collapses to the first violation; the rich detail (per-element contrast ratios, selectors, fg/bg colors) and screenshots are dropped. Needs `--out` + a screenshot/report bundle + full per-node a11y detail.
- **#1526 — multi-viewport sweep**: a single default viewport misses responsive/breakpoint issues.

## Living epic

This is a standing target, not a fixed scope. The 2026-06-22 run is the first forcing function; further gaps (e.g. from reviewing the captured screenshots, or auditing other apps) get filed as new children here. Each child is an independent slice — none blocks the others except where noted.
