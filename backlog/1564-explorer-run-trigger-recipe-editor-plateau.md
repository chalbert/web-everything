---
kind: story
size: 8
parent: "1548"
status: resolved
blockedBy: []
locus: plateau-app
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/explorer-runs/runsPage.ts"
tags: []
---

# Explorer run trigger + recipe editor (plateau)

The write-path layer over the explorer surface: launch a new run from the page, edit and save recipes (base URL, auth steps, routes goto/click, viewports), and show live run status — driving the #1562 executor endpoint and surfacing results via the #1563 viewer. The v1.1 layer atop the proven read-path (A+B). Slice C of #1548; blocked by #1562, #1563 (itself a future /slice candidate).

## Progress (resolved 2026-06-22, batch-2026-06-22-1580-1579-1030-1564)

Built the write-path surface as a headless store + recipe CRUD endpoints + a new plateau page (prereqs
#1562 executor/store + #1563 viewer both resolved; `blockedBy` cleared):

- **`plateau:src/explorer-runs/recipeStore.ts`** — `RecipeStore`: fs-backed per-recipe CRUD
  (`list`/`get`/`save`/`remove`, #1145 per-entry files, no index). A `Recipe` = the explorer `--auth` shape
  (`storageState`/`steps`/`routes`/`viewports`) + `id`/`name`/`baseUrl` metadata; `validateRecipe` mirrors
  the explorer's own rule (needs storageState/steps/routes) so a saved recipe is never one the explorer would
  reject, and create never clobbers (slug `-2`/`-3` dedupe). `loadAuthRecipe` ignores the extra metadata
  keys, so a stored recipe file is passed **verbatim** as `--auth` — no lowering step.
- **`plateau:vite.config.mts`** — new `explorerRecipes()` plugin (`GET`/`POST /api/explorer/recipes`,
  `GET`/`DELETE /:id`, registered before `mockApi`), and the existing `explorerRuns()` POST extended to accept
  `{ url, recipeId? }` → resolves `recipeId` to its recipe file path for `--auth`.
- **`plateau:src/explorer-runs/runsPage.ts` + `plateau:src/explorer-runs/runsPage.css`** — `mountExplorerRuns`: a "New run" trigger
  (recipe picker + target URL → `POST /runs` → **poll live status** running→done/failed → bundle link into
  the #1563 history viewer) and a recipe editor (list + name/baseUrl fields + validated JSON-array textareas
  for steps/routes/viewports + save/new/delete). Pure render/parse helpers exported for tests. Wired into
  `plateau:src/main.ts` (route `/explorer-runs` + breadcrumb + robust-timing mount) and `plateau:index.html`
  (nav link + `<template route>` mount div). The recipes dir is git-ignored.

**Tests/verification:** `plateau:src/explorer-runs/recipeStore.test.ts` (15) + `plateau:src/explorer-runs/runsPage.test.ts` (11) — store CRUD/validation/persistence
+ render/parse contracts, headless. Full plateau suite **342 pass** (+26). Live on the running :4000 (config
auto-reloaded, server never restarted): recipe CRUD round-trips over curl (create/list/get/delete + 400 on
invalid), and a **Playwright** check logged in + client-side-navigated to `/explorer-runs` → page mounts
(both forms render) and a recipe **saved through the form** appears in the run picker (no page errors).
