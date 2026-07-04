---
name: new-demo
description: Scaffold a new Web Everything demo the canonical way — a runtime page that exercises a standard in a real browser, wired into the registry, dev-server fallback, and quality gates. Use when the user wants to "create/add a new demo", "build a demo app", "add an exercise app", or otherwise introduce a new page under demos/.
---

# Authoring a Demo

This skill is a **trigger and pointer** — the method lives in
[docs/agent/demo-workflow.md](../../../docs/agent/demo-workflow.md) so every agent follows the same process;
don't duplicate it here — if the process changes, edit that doc. Building a flagship exercise app? Also read
[exercise-app-workflow.md](../../../docs/agent/exercise-app-workflow.md).

> **Runs in a lane — set it up FIRST (#2123).** Scaffolding a demo edits the tree, so work in an
> **isolated lane clone**, never the shared primary checkout (`we:scripts/guard-lane.mjs` blocks a primary
> `Edit` otherwise): `node we:scripts/lane-pool.mjs status --json` → pick a clean lane → author there →
> land via PR. Full rule: *backlog-workflow.md → Working an item*.

When invoked:

1. Read *demo-workflow.md → full doc* end-to-end. Honor the platform-first rule (consume active standards,
   never re-implement; resolve every surface against `src/_data/{blocks,intents,plugs}.json` first).

2. Decide the shape:
   - Single-file (`demos/{id}.{html,tsx,css}`) — one focused page exercising a block/adapter.
   - Routed folder app (`demos/{id}/{index.html,app.ts,app.css,conformance.json}`) — a multi-view app
     mounted at the base path `/demos/{id}/`. This shape has a base-path reload hazard: follow
     *demo-workflow.md → §6* exactly — `<route-view base="/demos/{id}" entry="/…">`, a `routePath()` seam for
     every `route:link`/redirect (never origin-root-absolute), and a `routerDemoFallback` entry in
     `vite.config.mts`. Don't hand-roll a `history.replaceState` boot shim.

3. Register it in `src/_data/demos.json` (`projects[]` must resolve in `projects.json`).

4. Verify with the *demo-workflow.md → §8* checklist. For routed folder demos this is non-negotiable:
   - `npm run check:demos` (static wiring — also runs inside `npm run check:standards`)
   - `npm run check:demos -- --live` (with the dev server up: entry + every deep route reload = 200)
   - `npm run check:demos -- --write-checklist` to (re)generate `demos/{id}/CHECKLIST.md`, then fill the
     `## Demo-specific` section.
   - `npm run check:app-conformance -- --app=demos/{id}` for the standard-conformance dimension.
