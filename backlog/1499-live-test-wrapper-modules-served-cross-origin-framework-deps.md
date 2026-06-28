---
kind: decision
size: 1
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
preparedDate: "2026-06-21"
graduatedTo: none
codifiedIn: one-off
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot, frontierui]
---

# Live-test wrapper modules served cross-origin (framework deps off the main tree)

The workbench live-test (#1030, parent #912) mounts a generated react/vue wrapper into the workbench
document (#955-A2, no iframe). The open question was WHERE the wrapper module **and its framework dep
(`react`/`react-dom`/`vue`)** are served from — which decides whether vendor deps must enter the running
`fui:` :3001 dev server's resolution (an `npm install` + Vite re-optimize/reload on a server the
don't-restart rule protects). Ruling: **serve the wrapper module from a SEPARATE origin and cross-origin-import
it; the framework dep lives only on that serving origin, never in the main `fui:` tree or the shipped bundle.**

## Ruling (cross-origin serve)

- **Dynamic import is origin-agnostic.** `await import('http://localhost:<port>/<block>.js?form=react-wrapper')`
  loads cross-origin fine when the serving origin sends CORS headers. #955-A2 forbids only the *iframe*, not a
  cross-origin module fetch — the imported module still mounts **same-document**. So `fui:workbench/mount.ts`
  imports a URL; it never does `import 'react'` itself, and whoever serves the URL resolves the framework dep.
- **Framework deps stay quarantined to the serving origin.** They go in that origin's own
  `fui:workbench/package.json` (granular-sub-package convention, #658/#693) — never root `fui:package.json`,
  never the shipped `@frontierui` bundle (framework-free invariant, #955-B).
- **Consequence:** the main :3001 tree never resolves react/vue, so adding them does not pre-bundle/reload it.
  This removes the #1030 `setup` human-gate — it becomes agent-doable.

## Why not same-origin (excluded fork)

Serving `/_maas/<block>.js?form=react-wrapper` from :3001's own Vite middleware pulls the framework dep into
:3001's resolution → re-optimize + full reload on the protected dev server, AND leaks vendor deps toward the
main tree. Flawed on both the don't-restart rule and the sub-package vendor-dep quarantine (#658/#693,
#955-B) — so this is a genuine fork, not support-both.

## Residuals (honest)

- **Two framework copies** (one per origin). Fine here — the wrapper mount is isolated and the workbench is
  framework-free, so nothing needs to share React context across the boundary.
- **CORS** on the serving origin for the :3001 origin — trivial in dev.
- **Current `_maas` topology — VERIFIED same-origin (the excluded fork).** `fui:vite-plugin.mjs`
  (`maasWrapperServe`) is mounted as `configureServer` middleware, and `fui:vite.config.mts:110` registers it
  directly in the MAIN dev-server config (`server.port: 3001`). So today `/_maas/<block>.js?form=react-wrapper`
  is served by :3001 itself. #1030's build must **relocate the wrapper serve to its own origin** (a second
  Vite/Node process, or a dedicated dev-only port) to satisfy this ruling.
- **Bare-specifier detail.** `fui:produceWrapperBytes.mjs` uses esbuild `transform` (single-file JSX→ESM, no
  bundle), so the served module keeps a bare `import 'react'`, and the middleware writes the bytes raw (no Vite
  rewrite). The clean cross-origin form is to esbuild-**bundle** react/vue into the wrapper bytes on the
  serving origin → a self-contained module, no import-map, no bare specifier. That IS the "two framework
  copies" residual above (benign here).
- **Precedent.** `fui:packages/rich-text-editor-slate/package.json` already carries its own `react`/
  `react-dom` as a quarantined sub-package — the convention this ruling relies on is already in use.

Confidence in the ruling: ~95% (cross-origin ES module import mechanics); topology now verified. Informs
#1030; lineage: surfaced in the 2026-06-21 session that corrected the #1030 manifest-home + node_modules
over-claims.
