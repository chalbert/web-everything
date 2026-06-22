---
kind: story
size: 5
parent: "912"
status: open
blockedBy: ["1556"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-22"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot]
---

# Workbench same-document live-test mount + react/vue devDeps

fui:workbench/live-test/: await import('/_maas/<block>.js?form=react-wrapper'), mount into the workbench document (no iframe — #955-A2), React error boundary + window.onerror/unhandledrejection runtime-error surfacing, wired to inspector/event/anatomy panels; add react/react-dom/vue as devDeps of the **workbench sub-package's own `fui:workbench/package.json`** (granular-sub-package convention, #658/#693) — never root `fui:package.json`, never the shipped @frontierui bundle (framework-free, #955-B).

## Dropped from batch-2026-06-19 (cascade-freed by #1029, but live FUI dev server)

Cascade-freed when #1029 resolved (its `blockedBy`), and the workbench panels it wires into exist in
`fui:workbench/mount.ts`. Deferred for the same live-dev-server class as siblings #449/#1046: this item's
acceptance is mounting a **react/vue wrapper into the live workbench on :3001** (verified live, PID 19026),
and adding `react`/`react-dom`/`vue` as workbench devDeps triggers Vite dependency pre-bundling on that
running server — a disruptive reload the dev-server instruction forbids ("leave servers as you found them").
It is also a deep cross-repo integration into the 947-line `fui:workbench/mount.ts` (live-test mount + React
error boundary + `window.onerror`/`unhandledrejection` surfacing + inspector/event/anatomy panel wiring) that
wants a focused `fui:` session. Resume via `/next 1030` in frontierui where the dev server can be restarted
after `npm install`.

**Re-confirmed 2026-06-20 (batch-2026-06-20):** still blocked-in-fact. The frontierui dev server is live
on :3001 (HTTP 200) and `react`/`react-dom`/`vue` are still absent — adding them
pre-bundles on that running server (the forbidden restart), and the acceptance is a live-on-:3001 mount
verification. Left for a focused frontierui session that owns the server lifecycle; not reattempted in the
batch.

**Corrected 2026-06-21 — setup gate REMOVED, now agent-doable (#1499 ruling).** Two errors in the notes
above, plus the gate itself was wrong. (1) **Manifest home** — the deps go in the workbench sub-package's own
`fui:workbench/package.json`, NOT root `fui:package.json` (granular-sub-package convention, #658/#693; vendor
framework deps stay quarantined to the one sub-package that live-tests wrappers). The earlier notes tracking
them against root `fui:package.json` were wrong. (2) **No :3001 disturbance** — per #1499, the wrapper module
is served from a **separate origin and cross-origin-imported** (`await import('http://localhost:<port>/…')`
— ES import is origin-agnostic; #955-A2 forbids only the iframe, not a cross-origin fetch, and the module
still mounts same-document). `fui:workbench/mount.ts` imports a URL and never does `import 'react'` itself, so
the framework dep lives only on the serving origin — the main :3001 tree never resolves react/vue, never
pre-bundles, never reloads. The prior 2026-06-19/-20 "blocked-in-fact" confirmations assumed same-origin
serving; that was the excluded fork.

**Build now (topology verified 2026-06-21):** `/_maas/` is currently same-origin — `maasWrapperServe` is
registered in the MAIN dev config (`fui:vite.config.mts:110`, `server.port: 3001`), the excluded fork. So:
1. **Relocate the wrapper serve to its own origin** — register `maasWrapperServe` on a second Vite/Node
   process (dev-only port, CORS-enabled), not the :3001 plugins array.
2. Add react/react-dom/vue to that serving sub-package's own `fui:workbench/package.json` (never root, never
   the shipped bundle).
3. Make the served module self-contained — esbuild-**bundle** react/vue into the wrapper bytes
   (`fui:produceWrapperBytes.mjs` currently uses `transform`, leaving a bare `import 'react'`; switch the
   wrapper path to a bundle so the cross-origin module needs no import-map).
4. Cross-origin-import + same-document mount in `fui:workbench/mount.ts` with the React error boundary +
   `window.onerror`/`unhandledrejection` surfacing, wired to inspector/event/anatomy panels.

Precedent: `fui:packages/rich-text-editor-slate/package.json` already quarantines its own `react`/`react-dom`.
Residuals (two framework copies, CORS) are benign — see #1499.

## Pre-flight (batch-2026-06-21-1429-1487) — split into infra + integration; now `blockedBy: 1501`

Claimed and grounded the live frontierui tree. The 2026-06-21 "now agent-doable" note is right about the
*topology* (cross-origin import avoids the :3001 pre-bundle) but its build steps 1–3 are **net-new infra
that does not exist yet**, verified at claim:
- **No second origin.** `maasWrapperServe` is still registered ONLY on the main :3001 config
  (`fui:vite.config.mts:110`) — the same-origin "excluded fork". The second dev-only Vite/Node process the
  approach requires has not been stood up.
- **`fui:tools/maas/produceWrapperBytes.mjs` still uses esbuild `transform`** (line 36, `jsx: 'transform'`),
  leaving a bare `import 'react'` — so a cross-origin module is **not** self-contained yet; the
  transform→bundle rework is unbuilt.
- **No `fui:workbench/package.json`** (react/react-dom/vue absent); **no `fui:workbench/live-test/` dir.**

`#1499` is a **resolved *decision*** (`graduatedTo: none`, codified one-off) — it *ruled* cross-origin
serving is allowed, it did **not** build the serving process. So steps 1–3 are a real, currently-absent
**prerequisite**, now filed as **#1501** (the cross-origin wrapper-serve dev process: second origin + CORS
+ esbuild-bundle react/vue into wrapper bytes). This item is the **mount-integration half** (steps 4–5:
`fui:workbench/live-test/` + the deep `fui:workbench/mount.ts` integration + React error boundary +
`window.onerror`/`unhandledrejection` surfacing + panel wiring), whose acceptance is a **live in-browser
mount** that needs #1501's running second origin. Set `blockedBy: 1501`; released back to `open`.
Carry-forward reason: **blocked-in-fact** (prerequisite infra verified absent, now encoded as a real edge,
not a gut "looks big" call) — the live-mount-on-a-running-second-origin acceptance also wants a focused FUI
session that owns the dev-server lifecycle.

## Pre-flight (batch-2026-06-21-1501-1356) — #1501 infra now landed; remaining half is a focused live-mount session

The prerequisite #1501 (cross-origin wrapper-serve second origin + esbuild-bundle) **resolved this batch**, so the `blockedBy` is cleared. But this item's own half is unchanged: the deep integration into the 947-line `fui:workbench/mount.ts` (cross-origin-import + same-document live-test mount + React error boundary + `window.onerror`/`unhandledrejection` surfacing + inspector/event/anatomy panel wiring) whose acceptance is a **live in-browser mount on the running :3002 second origin**. That is a focused FUI session that owns the dev-server lifecycle (start :3002 + browser-verify the mount), not a concurrent-batch slice. Carry-forward reason: **blocked-in-fact** (live-mount-on-running-origin verification + deep `fui:workbench/mount.ts` integration). Left `open`, unblocked, for `/next 1030` in a frontierui session.

## Pre-flight (batch-2026-06-22-1510-1483) — a forced producer-side prerequisite surfaced → `blockedBy: 1518`

Claimed + ground the live frontierui tree to actually build it (the prior "needs a focused session" framing is a gut stop the batch rule kills, so I tried). Grounding surfaced a **real, currently-absent prerequisite** that #1501 did not cover:

- `fui:tools/maas/produceWrapperBytes.mjs` emits **only the source-display form** — the generated wrapper component (`export default Comp`, react bundled, **no react-dom, no renderer, no error boundary**). The existing workbench Polyglot panel (`fui:workbench/mount.ts:633`) shows this as **source text only** (it explicitly notes "no live render, #912").
- The workbench **must stay framework-free** (#955-B), so `fui:workbench/mount.ts` **cannot** `import 'react-dom'` to render the cross-origin component. Importing react-dom from the second origin *separately* would split the React instance from the wrapper's bundled react — a **react/react-dom instance-mismatch bug** (react-dom must share the exact react instance the component renders with).
- Therefore a live mount **requires a served mount form** (e.g. `?form=react-live`) that bundles **react + react-dom + an ErrorBoundary together** and exports `mount(el, props)` / `unmount()`. That is forced design (per #955, not an open fork) but is **net-new producer/generator/endpoint work** outside this item's stated "steps 4–5 workbench-side" scope.

Filed that prerequisite as **#1518** (`fui:tools/gen-wrapper/genWrapper.mjs` live-mount variant + `fui:tools/maas/produceWrapperBytes.mjs` react-dom bundle + `fui:tools/maas/vite-plugin.mjs` form-serve) and set `blockedBy: 1518`. This item stays the **workbench-side half** (cross-origin-import the `react-live` module → same-document mount → `window.onerror`/`unhandledrejection` surfacing → inspector/event/anatomy wiring + live :3002 browser verification). Carry-forward reason: **blocked-in-fact** (forced prerequisite verified absent, now a real edge). Released to `open`.

## Pre-flight (batch-2026-06-22-1545-1549) — #1518 landed; built toward it, hit a verified CORS gap on the serve origin → `blockedBy: 1556`

Claimed and **built toward the live mount** rather than re-declining (the "needs a focused session" framing
is the gut stop the batch rule kills). The producer side from #1518 is real and correct: workbench
`fui:workbench/package.json` quarantines react/react-dom/vue; the catalog declares `react-live`/`vue-live`
(`fui:tools/gen-wrapper/wrapperFormCatalog.mjs`); the contract is `mount(el, props?) => {update, unmount}` +
`unmount()` with `createRoot` + a bundled ErrorBoundary (`fui:tools/gen-wrapper/genWrapper.mjs:223`). A
throwaway maas origin on a fresh port (current code, user's stale :3002 untouched — it predates #1518 and
reports the old `declarative/wc-class/html/jsx/functional` form set) **serves the live module correctly over
same-origin curl** (200, ~1 MB, `export { …, mount, unmount }`, react-dom bundled, 25 createRoot/boundary
hits).

**But the cross-origin browser import — this item's whole premise — FAILS.** Real Playwright arbiter: a page
on the running :3001 host doing a cross-origin `import()` of the `?form=react-live` module throws
`TypeError: Failed to fetch dynamically imported module`. The serve origin emits **no CORS headers** (no
`Access-Control-Allow-Origin` on the `302` pin redirect or the `200`; `OPTIONS` → `302`), so
`server: { cors: true }` in `fui:vite.maas.config.mts` is not reaching the custom `maasWrapperServe`
middleware route. This is a **producer-side (serve-origin) gap, not the consumer's scope** — #1499/#1501
ruled+stood-up cross-origin serving but never verified a cross-origin browser import (only same-origin
handler unit tests). Filed as **#1556** (maas-origin CORS fix) and set `blockedBy: 1556`. Carry-forward
reason: **blocked-in-fact** (the cross-origin import the consumer needs is browser-verified to fail until the
serve origin emits CORS). No consumer code written (nothing to land until #1556). Released to `open`.
