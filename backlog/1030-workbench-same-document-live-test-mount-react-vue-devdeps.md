---
kind: story
size: 5
parent: "912"
status: resolved
blockedBy: []
dateOpened: "2026-06-19"
dateStarted: "2026-06-22"
dateResolved: "2026-07-09"
graduatedTo: none
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot]
---

# Workbench same-document live-test mount + react/vue devDeps

fui:workbench/live-test/: await import('/_maas/<block>.js?form=react-wrapper'), mount into the workbench document (no iframe — [constellation-placement](docs/agent/platform-decisions.md#constellation-placement), #955-A2), React error boundary + window.onerror/unhandledrejection runtime-error surfacing, wired to inspector/event/anatomy panels; add react/react-dom/vue as devDeps of the **workbench sub-package's own `fui:workbench/package.json`** (granular-sub-package convention, #658/#693) — never root `fui:package.json`, never the shipped @frontierui bundle (framework-free, #955-B).

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

## Pre-flight (batch-2026-06-22-1575-1030) — #1556 landed; MECHANISM NOW PROVEN end-to-end; only blocker left is the server lifecycle

Claimed with all prerequisites resolved (#1501/#1518/#1556) and **proved the cross-origin live-mount
mechanism works end-to-end** — the first pre-flight to actually run it rather than stop at a blocker:

- Stood up a **throwaway** maas origin (`fui:vite.maas.config.mts`, fresh port :3009 — the user's running
  :3002 left untouched, never restarted). It serves `?form=react-live` correctly: `302` pin → `200`,
  `Access-Control-Allow-Origin: *` on **both** (the #1556 CORS fix), `content-type: text/javascript`, a
  ~1 MB self-contained module exporting `{ <Block>Element, mount, unmount }` with `createRoot`/ErrorBoundary
  bundled (the #1518 producer).
- **Real Playwright arbiter:** a page on the :3001 host origin did a cross-origin `import('http://localhost:3009/_maas/<block>.js?form=react-live')`, then `mod.mount(el, {})` → **rendered React DOM into the element**
  (no `Failed to fetch` / CORS error), and `mod.unmount()` torn down cleanly. So the consumer premise
  (cross-origin import + same-document mount, no iframe, #955-A2) is **verified working**, not theoretical.

**The only remaining blocker is environmental, and it's the server lifecycle this item has always needed:**
- The **running :3002 is stale** — it serves the OLD form set (`declarative/wc-class/html/jsx/functional`)
  and 400s `Unknown form "react-live"`. Vite `configureServer` middleware (`fui:tools/maas/vite-plugin.mjs`)
  does **not** hot-reload, so serving the new form on :3002 needs a **process restart**.
- :3002 is part of the user's `npm run dev` (concurrently DOCS/DEMO/MAAS); the don't-restart-the-user's-server
  rule forbids restarting it in a concurrent batch. The e2e harness (`fui:playwright.config.ts`) uses
  `reuseExistingServer`, so it would bind the **stale** :3002 too — it can't verify the new form either.
- Therefore the item's stated acceptance (a **live mount on the running :3002**, wired into the panels) needs
  a **focused frontierui session that owns the dev-server lifecycle**: restart :3002 with current code, then
  build + browser-verify against the real running second origin.

**Design note for that session (not yet decided):** "wired to inspector/event/anatomy panels" is **not
mechanical** for a cross-origin React render. The inspector reads the **stage** rendered tree
(`querySelector`/`getComputedStyle`, `fui:workbench/mount.ts:7`), the event log listens on the **stage**, and
the anatomy panel reflects the **block's intent/trait/token declaration** — none of which reach a React
component mounted in the Polyglot panel. So the integration must first decide **where the live mount renders**
(into the stage, replacing the native custom element as the subject, so the existing panels cover it for free
— vs. a separate Polyglot live-preview that needs new introspection wiring) and how the panels introspect a
non-custom-element render. Worth a small decision before the build.

Carry-forward reason: **blocked-in-fact** (verified: live-on-:3002 acceptance needs a :3002 restart this
concurrent batch can't perform; mechanism otherwise proven). `blockedBy` cleared (#1556 resolved); released to
`open` for `/next 1030` in a frontierui session that owns the server.

## 2026-06-22 — render-target fork extracted to decision #1594; `blockedBy: 1594`

The "design note for that session (not yet decided)" above is a **real fork, not a build-time detail**, so it
is now a `type:decision` work item (**#1594**): does the cross-origin React live-mount render **into the stage
as the subject** (so inspector/event/anatomy panels cover it for free) **vs a separate Polyglot live-preview**
needing net-new introspection wiring. The build (cross-origin import → same-document mount → error-surfacing →
panel wiring) **can't be authored until that render target is ruled**, since it dictates where `mount(el, …)`
points and how the panels introspect. Set `blockedBy: 1594`. The :3002-restart residual still stands, but it
is downstream of the decision, not a substitute for it.

## 2026-07-09 — `humanGate` removed; item is now agent-doable in a focused FUI session

The `humanGate: { kind: setup }` (restart :3002 + decide the render fork) is **dropped** — both of its two
stated reasons are stale:

1. **The render-target fork is RESOLVED.** #1594 ratified 2026-06-22 → render the live subject **into the
   stage** (Fork 1a; codified `we:docs/agent/platform-decisions.md#single-introspection-slot`). #1594 itself
   states "**#1030 now agent-ready**" with the three amendments (subject-node resolution, prop-routed
   `instance.update`, `unmount()` teardown) folded into this item's scope. `blockedBy` is correctly clear
   (#1594 resolved).
2. **The ":3002 restart" is not human-only.** batch-2026-06-22-1575-1030 already proved the full mechanism
   end-to-end against a **throwaway maas origin** (:3009) with the user's :3002 untouched. So "verify against
   the running :3002" is a self-imposed acceptance framing, not a hard requirement — a focused frontierui
   session can spin its own throwaway origin and browser-verify, exactly as that batch did.

What remains is **pure agent work**, not human setup: the `fui:workbench/mount.ts` integration (cross-origin
import → same-document mount into the stage → `window.onerror`/`unhandledrejection` surfacing) + the three
Fork-1(a) amendments, browser-verified against a freshly-spun throwaway maas origin. Resume via
`/next 1030` in a frontierui session that owns a dev-server lifecycle.

## 2026-07-09 — DONE (frontierui PR #28)

Built + landed the workbench-side integration exactly as scoped. **frontierui PR
[#28](https://github.com/chalbert/frontierui/pull/28)** (`lane/1030-workbench-live-mount`):

- **`fui:workbench/loader.ts`** — the `served` arm now surfaces the served module's `mount()`/`unmount()`
  live contract (`live`) + an optional `load` that registers the native element locally (framework-free,
  #955-B) so the React/Vue wrapper drives a genuinely-live `<tag>`, not an inert placeholder.
- **`fui:workbench/live-test/liveMount.ts`** (new) — the host-side lifecycle the #1518 served module doesn't
  own: subject-node resolution (a `MutationObserver` catches React's possibly-deferred commit) + async
  runtime-error surfacing (`window` `error`/`unhandledrejection`, beyond the wrapper's own ErrorBoundary).
- **`fui:workbench/mount.ts`** — `renderStage` live branch with the three #1594 Fork-1(a) amendments:
  (1) subject-node resolution (panels read the wrapper's inner element), (2) prop-routed control
  (`handle.update(props)`), (3) `unmount()` teardown on refresh (no leaked framework root). Adds a
  Runtime-errors panel; `exportAsCode` emits the wrapper source for a live subject (the #1594
  "supported by default" Storybook custom-`render` footgun).
- **`fui:workbench/registry.ts`** — a `<background-tasks>`-live served block + `withServedOrigin()`;
  **`fui:demos/workbench.ts`** honours `?maas=<origin>` (library stays origin-agnostic).

**Verified:** browser-verified against a real cross-origin `?form=react-live` module (throwaway :6181/:6182
pair, user's servers untouched) — the wrapper renders the real `<background-tasks>` into the stage,
`update({retry})` reflects onto the live element, `unmount()` tears the root down clean. 47 workbench vitest
tests green (new `liveMount` unit + `mountLive` integration cover all three amendments + the error surface);
`check:standards` 0 errors.

**Leftover filed → #2374:** the full workbench demo entry has a **pre-existing** `node:fs/promises`-externalized
break (reproduces on `main` with the stock `?block=auto-complete`), so the live block is verified via its own
code path rather than the demo's `workbenchReady`. Not a #1030 regression; downstream of the demo-graph fix.
