---
kind: story
size: 5
status: resolved
locus: frontierui
relatedProject: webdocs
parent: "912"
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: frontierui/tools/maas/produceWrapperBytes.mjs
tags: [webdocs, block-explorer, workbench, polyglot]
---

# fui: cross-origin wrapper-serve dev process — second origin + CORS + esbuild-bundle react/vue into wrapper bytes

Stand up the prerequisite cross-origin serving infra #1030 needs (and #1499 ruled): relocate maasWrapperServe off the main :3001 config onto a SECOND dev-only Vite/Node process (separate port, CORS-enabled), add react/react-dom/vue to a new fui:workbench/package.json (never root, never the shipped bundle), and switch fui:tools/maas/produceWrapperBytes.mjs from esbuild transform to a self-contained bundle so the cross-origin module carries react/vue in its bytes and needs no import-map. Per #1499 (cross-origin import keeps the dev server clean) — this is the infra half; #1030 is the mount-integration half that blockedBy this. locus frontierui; live verification owns the dev-server lifecycle.

## Progress

Landed (locus frontierui):
- `fui:workbench/package.json` — new quarantine home for `react`/`react-dom`/`vue` (never root, never shipped bundle, #955/#1030); `workbench` added to root `workspaces`; `npm install` brought vue in.
- `fui:vite.maas.config.mts` — the dev-only SECOND origin (:3002, `server.cors:true`) serving ONLY the `/_maas/` middleware; `maasWrapperServe` removed from the main `fui:vite.config.mts` (:3001 now framework-free); `dev:maas` script added + folded into the `dev` concurrently triad.
- `fui:tools/maas/produceWrapperBytes.mjs` — switched esbuild `transform` → `build`/`bundle` (self-contained ESM, react/vue resolved out of `workbench/` via `resolveDir`, no host import-map); `PRODUCER_VERSION` 1→2 for the output-shape change.
- Tests updated for self-containment (no bare `from 'react'`/`from 'vue'`): `fui:tools/maas/__tests__/produceWrapperBytes.test.mjs` + `fui:tools/maas/__tests__/wrapperServeHandler.test.mjs` — 14/14 green; `check:standards` 0 errors.
- Cross-origin live-mount verification is #1030's half (blockedBy this).
