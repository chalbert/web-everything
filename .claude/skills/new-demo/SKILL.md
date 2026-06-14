---
name: new-demo
description: Scaffold a new Web Everything demo the canonical way — a runtime page that exercises a standard in a real browser, wired into the registry, dev-server fallback, and quality gates. Use when the user wants to "create/add a new demo", "build a demo app", "add an exercise app", or otherwise introduce a new page under demos/.
---

# Authoring a Demo

This skill is a **trigger and pointer** — the method lives in
[docs/agent/demo-workflow.md](../../../docs/agent/demo-workflow.md) so every agent follows the same
process and there is nothing to keep in sync here. Building a flagship **exercise app**? Also read
[docs/agent/exercise-app-workflow.md](../../../docs/agent/exercise-app-workflow.md).

When invoked:

1. **Read [docs/agent/demo-workflow.md](../../../docs/agent/demo-workflow.md)** end-to-end. Honor the
   **platform-first rule** (consume active standards, never re-implement; resolve every surface against
   `src/_data/{blocks,intents,plugs}.json` first).

2. **Decide the shape:**
   - **Single-file** (`demos/{id}.{html,tsx,css}`) — one focused page exercising a block/adapter.
   - **Routed folder app** (`demos/{id}/{index.html,app.ts,app.css,conformance.json}`) — a multi-view
     app mounted at the base path `/demos/{id}/`. This shape has a **base-path reload hazard**: follow
     §6 exactly — `<route-view base="/demos/{id}" entry="/…">`, a `routePath()` seam for every
     `route:link`/redirect (never origin-root-absolute), and a `routerDemoFallback` entry in
     `vite.config.mts`. Don't hand-roll a `history.replaceState` boot shim.

3. **Register** it in `src/_data/demos.json` (`projects[]` must resolve in `projects.json`).

4. **Verify** with the §8 checklist. For routed folder demos this is non-negotiable:
   - `npm run check:demos` (static wiring — also runs inside `npm run check:standards`)
   - `npm run check:demos -- --live` (with the dev server up: entry + every deep route reload = 200)
   - `npm run check:demos -- --write-checklist` to (re)generate `demos/{id}/CHECKLIST.md`, then fill the
     `## Demo-specific` section.
   - `npm run check:app-conformance -- --app=demos/{id}` for the standard-conformance dimension.

Do not duplicate the method here — if the process changes, edit `demo-workflow.md`.
