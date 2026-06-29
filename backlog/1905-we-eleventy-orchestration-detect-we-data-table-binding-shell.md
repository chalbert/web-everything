---
kind: story
size: 5
parent: "1600"
locus: webeverything
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-29"
dateResolved: "2026-06-29"
tags: [data-table, ssr, build-integration, eleventy]
---

# WE Eleventy orchestration: detect we-data-table binding, shell out to FUI CLI, splice SSR

Slice C of the #1867 harness — the integration slice. A new WE Eleventy build hook (`we:.eleventy.js:259-272` seam) detects a `we-data-table` `rows` web-expression binding, gathers the deterministic build context, shells out to the FUI build-CLI (slice A, #1902) over the subprocess boundary, and splices the returned SSR `<table>` HTML. The build NEVER reads the dev /_maas/data/ route (#workbench-inert-data-static-slot). No build-time evaluator or FUI subprocess exists in WE today (we:src/_data/buildId.js:7,11 is the only execSync). Demoable on one real #1600-family surface or a build fixture. Homed in WE (locus: webeverything). blockedBy A (#1902, the CLI) and B (#1904, the enhancer).

## Carry (batch-2026-06-28-1905-1945 pre-flight) — re-blocked on #1946

Claimed and grounded; the ratified mechanism is clear (#1867: detect `<we-data-table rows="[[ ref ]]">`, resolve the bare ref from build-known context, shell to the FUI CLI, splice the SSR `<table>` + a co-located inert JSON island). **But the prerequisite is verified absent:** slice C must shell to a *locked compiled build-artifact, never PATH-resolved*, yet slice A (#1902) shipped only `fui:tools/data-table-build/cli.ts` — FUI `fui:tsconfig.json` `include` is `[plugs, blocks, adapters, config]`, so `tools/` is **not** compiled (no emitted cli, `fui:dist/tools` absent), and there is no cross-repo build-ordering for WE to invoke it. Building+pinning that artifact is filed as **#1946**; #1905 is re-pointed `blockedBy: ["1946"]` (the prior #1902/#1904 edges are resolved). Released to `open` — not a gut stop, a real missing artifact.

## Unblocked — #1946 delivered the pinned artifact (2026-06-28)

#1946 resolved: FUI now emits the locked CLI via `npm run build:tools` (typecheck `fui:tsconfig.tools.json` → esbuild bundle) to the **fixed pinned path `fui:dist/tools/data-table-build/cli.mjs`** (resolved from WE via the sibling `../frontierui` checkout) — self-contained ESM, `node_modules` external, never PATH-resolved. The verified keyed-batch contract: stdin `[{key,rows,config}]` → stdout `{producer, results:[{key,html|error}]}` (per-entry isolation confirmed). **Build ordering** (now ratified in `we:docs/agent/platform-decisions.md#ssr-data-table-build-harness`): FUI `build:tools` runs **before** WE `build:docs`; a missing artifact is a hard build error, never a silent skip. `blockedBy` cleared. #1905's remaining work is the WE Eleventy hook itself (detect the binding, gather the build context, shell `node <pinned> < batch > out`, splice the SSR `<table>`).
