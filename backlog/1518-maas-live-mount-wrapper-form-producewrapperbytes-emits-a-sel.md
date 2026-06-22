---
kind: story
size: 5
status: resolved
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:tools/maas/produceWrapperBytes.mjs"
tags: []
---

# MaaS live-mount wrapper form — produceWrapperBytes emits a self-contained mountable module (react-dom + error boundary + mount/unmount)

Prerequisite for #1030's workbench live-test mount, surfaced in batch-2026-06-22-1510-1483. #1501 stood up the cross-origin wrapper-serve second origin (`fui:vite.maas.config.mts` :3002) + the transform→esbuild-bundle switch, but only for the **source-display** form: `fui:tools/maas/produceWrapperBytes.mjs` emits the generated wrapper component (`export default Comp`, react bundled, **no react-dom, no renderer, no error boundary**). A live mount needs a **served mount form** that bundles react + react-dom + an ErrorBoundary together and exports a stable host contract — so #1030 can cross-origin-import it and mount same-document without the workbench importing a framework.

## Why a new served form is forced (per #955, not an open fork)

The workbench (`fui:workbench/mount.ts`) **must stay framework-free** (#955-B), so it **cannot** `import 'react-dom'` to render the cross-origin component, and importing react-dom from the second origin *separately* would **split the React instance** from the wrapper's bundled react (a real react/react-dom instance-mismatch bug — react-dom must share the exact react instance the component renders with). Therefore a live mount **requires** the served module itself to bundle react + react-dom + the error boundary and expose `mount`/`unmount`.

## Work

- **`fui:tools/gen-wrapper/genWrapper.mjs`** — emit a live-mount wrapper variant: wrap the generated component in a React `ErrorBoundary` (class component) so a render throw is caught + reported (not a blank host), and export `mount(el, props?) => instance` + `unmount()` (with a Vue `createApp(...).mount` analog for the `vue` target).
- **`fui:tools/maas/produceWrapperBytes.mjs`** — bundle `react-dom` (not just `react`) for the live form; bump `PRODUCER_VERSION`.
- **`fui:tools/maas/vite-plugin.mjs`** — serve the new `form` (e.g. `?form=react-live` / `vue-live`).

## Acceptance

- `http://localhost:3002/_maas/<tag>.js?form=react-live` returns a **self-contained** ESM module exporting `mount`/`unmount`, with **react-dom bundled in** and **zero bare `import`** (a cross-origin module needs no import-map).
- A render throw inside the mounted wrapper is caught by the ErrorBoundary and surfaced, not a blank mount.
- Unblocks **#1030** (the workbench-side cross-origin-import + same-document mount + panel wiring + live :3002 verification).
