---
kind: story
size: 21
locus: plateau-app
status: open
dateOpened: "2026-06-22"
tags: [plateau-app, explorer, devtool-surface]
---

# Plateau page: explorer run management + report history

A plateau-app product surface to run the FUI explorer and browse its report history — the UI layer over the now-complete explorer CLI (epic #1522, engine #1167). Big; **for later** — split into slices when picked up.

## Why plateau (placement decided)

It's a product/ops surface consuming a FUI devtool, exactly like the existing `plateau:src/design-review/`, `plateau:src/vision-review/`, and `plateau:src/control-plane/` pages — and the explorer's a11y/conformance output belongs in the same quality loop those serve. The page dogfoods FUI components (#1254). FUI stays the engine (`fui:tools/explorer/`); plateau owns the surface and the executor that drives it. Consistent with #809 (workbench is FUI-owned) because this is an ops console over runs, not the component playground.

## Three parts

1. **The page** (plateau) — list past runs (history), open a run's rendered report + screenshots inline, trigger a new run from a recipe (base URL, auth steps, `routes` goto/click, viewports), show run status. Dogfoods FUI components.
2. **The executor** (the new piece — a page can't run Playwright) — a server-side endpoint (plateau dev-server middleware, mirroring its existing `/api/*` mock layer) that shells out to the FUI explorer (`fui:tools/explorer/cli.ts -- <url> --auth <recipe> --out <dir>`), tracks status, and returns the bundle location.
3. **The bundle store** — the per-run `--out` bundles (rendered report + findings JSON + screenshots) on disk, indexed by run (timestamp, target, recipe). The CLI already writes these; the store just organises + serves them.

## Planned slices (carve when picked up)

- **A — bundle store + executor endpoint**: run the CLI, persist a bundle, list/serve runs. The de-risking foundation.
- **B — history viewer (read-only)**: a plateau page that lists past runs and renders a selected bundle (report + screenshots) inline. Useful on its own, no trigger needed.
- **C — trigger + recipe editor**: launch a run from the page, edit/save recipes (base URL, auth, routes, viewports), live status.

v1 should be A+B (browse existing bundles) before C (trigger/manage), so the executor is proven read-path-first.

## Depends on

The explorer CLI's `--auth` recipe + `--out` bundle (epic #1522 — resolved). No engine work remains; this is purely the surface + executor over it.
