---
type: idea
workItem: story
size: 13
parent: "746"
status: open
blockedBy: ["753", "955", "977"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Polyglot panel — live-test sandbox: execute the generated wrapper in an embedded sandbox

Block Explorer polyglot-panel slice (b), sibling of #753. Build the embedded live-test sandbox that transpiles and mounts the generated React/Vue wrapper source (from #753's consume-mode tabs / genWrapper) and renders it live with runtime-error surfacing — the body's flagged non-trivial sub-build. In-browser transpile approach (esbuild-wasm / Babel-standalone) is a builder impl choice, not a fork. Home fui:workbench/. locus:frontierui.

> **Claimed in batch-2026-06-18, then re-blocked + re-sized (NOT built).** Tracing the real
> `generateWrapper` output (`fui:tools/gen-wrapper/genWrapper.mjs`) shows "transpile is the only impl
> choice" undersold the build: the wrapper is **TS+JSX importing `react`** that renders the **real custom
> element**, so a live preview also needs a **React/Vue runtime** and the **element defined in the
> sandbox** — and the workbench registers elements via bundled static imports
> (`fui:workbench/registry.ts:148`) with no reusable module URL to load into an isolated frame. That
> exposes a genuine strategy fork (element isolation: iframe vs same-doc; runtime loading: CDN import-map
> vs bundling React/Vue into FUI — the latter conflicts with FUI's framework-free principle). Filed
> **[#955](/backlog/955-decide-the-polyglot-live-test-sandbox-strategy-framework-run/)** (`blockedBy: 955`),
> re-sized **5 → 8**. The #954 ruling also puts #913's behavioral badge downstream of this sandbox.

> **Claimed again in batch-2026-06-18 with all blockers resolved (#753/#955/#977 ✓, and the #974
> wrapper-serve protocol ✓ resolved) — OUTGREW size 8, re-sized 8 → 13, released NOT built.** With the
> strategy now settled (#955: A2 same-document mount · #974: the endpoint conforms to the existing
> `we:blocks/renderers/module-service/servePathIR.ts` contract, framework on the catalog-gated `form`
> param via #977's `react-wrapper`/`vue-wrapper`), the concrete build is four separable, individually
> substantial pieces — well beyond one size-8 seam (the 8 was set before #974 pinned the endpoint to the
> *whole* servePathIR surface):
>
> 1. **FUI `/_maas/` wrapper-serve endpoint** (Vite `configureServer` middleware) conforming to
>    `servePathIR` + `maas-versioning`: parse `<name>[@<pin>].js?form=react-wrapper|vue-wrapper&target=…`,
>    run `fui:tools/gen-wrapper/genWrapper.mjs` + esbuild transpile, serve ESM with the **302 floating→pin
>    ladder, content-hash identity folding the genWrapper producer version, `ETag`/`X-MaaS-Integrity`
>    (SRI), `X-MaaS-Producer`, `X-MaaS-Lossy`, `CACHE_POLICY` immutable/floating, and the 400/404/500
>    error set**. FUI implements its own handler conforming to the type-only WE contract (must NOT import
>    WE's runtime `fetchHandler` — #855/#817). This alone is a meaty slice.
> 2. **Workbench same-document live-test mount** (`fui:workbench/live-test/`): `await import('/_maas/<block>.js?form=react-wrapper')`,
>    mount the wrapper into the workbench document (no iframe, no postMessage — #815/#955-A2), React error
>    boundary + `window.onerror`/`unhandledrejection` for runtime-error surfacing, wired into the existing
>    inspector/event/anatomy panels (host-side reads that only work same-document). Integrates with the
>    51 KB `fui:workbench/mount.ts`.
> 3. **devDependencies + runtime resolution** — add `react`/`react-dom`/`vue` as workbench **devDeps**
>    (never the shipped `@frontierui` bundle — framework-free preserved, #955 Fork B); Vite resolves the
>    wrapper's bare `react` import from `node_modules`, offline in dev + e2e.
> 4. **Playwright e2e** reusing the vendored runtime (no uncontrolled external network): mount a block's
>    react-wrapper, assert it renders + a thrown error surfaces in the error panel.
>
> **Suggested next step: `/split 912`** into (1) endpoint, (2) workbench mount + devDeps, (3) e2e — each
> independently batchable (1 is a clean story·5–8 with its own conformance check against servePathIR; 2
> depends on 1; 3 depends on 2). No design fork remains — #955/#974 settled all of them; this is purely a
> size/decomposition re-scope, not a new decision.
