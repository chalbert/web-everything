---
kind: story
size: 5
parent: "1522"
locus: plateau-app
status: resolved
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau-app:tools/explorer/reportBundle.ts — --out bundle (annotated screenshots + full per-node a11y/contrast detail)"
tags: []
---

# Explorer CLI: actionable audit artifact (--out bundle, screenshots, full a11y detail)

Add --out <dir> producing a durable report bundle: per-finding screenshots with offending elements annotated, full per-node a11y detail (color-contrast ratios, selectors, fg/bg colors — currently collapsed to first violation), plus md+json. Makes findings actionable without a re-run.

## Where / prototype

Two drops to recover: (1) `plateau-app:tools/explorer/cli.ts` only prints md/json to stdout — no screenshots, no file output; (2) `noA11yViolations` in `plateau-app:tools/explorer/oracles/genericInvariants.ts` reduces each state's axe result to a count + the FIRST violation id, discarding the per-node detail (`color-contrast` ratios, target selectors, fg/bg) that `plateau-app:tools/explorer/oracles/playwrightCollector.ts` already reads from axe. The plateau prototype (`plateau-app:tools/explorer/plateau-audit.ts`) re-ran axe to recover that detail, annotated offending elements before each screenshot, and wrote a md+json+screenshots bundle — productize that as `--out`.

## Resolved (2026-06-22) — `--out <dir>` writes a Markdown report + findings JSON + annotated screenshots

New `plateau-app:tools/explorer/reportBundle.ts` holds an opt-in `ArtifactCollector` (captured DURING the walk, since states don't survive reset-and-replay) + a `writeBundle` writer. Per observed state it runs the FULL axe read — recovering the per-node detail the Layer-1 oracle drops (`color-contrast` ratios, target selectors, fg/bg) — outlines the offending elements (outline doesn't reflow, so the DOM signature is unaffected), screenshots the page, then restores it. The sink threads through the collector (`plateau-app:tools/explorer/oracles/playwrightCollector.ts` gained a `CollectorOptions.artifacts`) and all three harnesses; `plateau-app:tools/explorer/cli.ts` adds the `--out` flag and writes the bundle after the walk.

**Validated on two apps:** `node plateau-app:tools/explorer/cli.ts -- http://localhost:4000/ --auth <recipe> --out <dir>` reproduced the plateau logged-in audit in ONE command — 8 authenticated states, a Markdown report with per-state screenshots (stat-card labels outlined as the 2.84:1 offenders) + contrast tables (selector · ratio · fg/bg), a findings JSON, and 8 annotated PNGs. Re-ran `--out` on the FUI docs site (`:8082`, no auth) → 4-state bundle. Full explorer suite green (88).

With #1523 (auth) + #1530 (honest a11y) + this, the CLI now reproduces what the bespoke `plateau-app:tools/explorer/plateau-audit.ts` harness did — the harness can be retired once whole-app route discovery (#1524) lands (the BFS click-walk reaches fewer routes than the harness's explicit list).
