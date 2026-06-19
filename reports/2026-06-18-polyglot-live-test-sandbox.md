# Polyglot live-test sandbox — strategy survey (prep for decision #955)

**Date:** 2026-06-18 · **Decision:** [#955](/backlog/955-decide-the-polyglot-live-test-sandbox-strategy-framework-run/)
· **Epic:** [#746 Block Explorer](/backlog/746-block-explorer-interactive-fui-block-workbench/) ·
**Blocks:** [#912](/backlog/912-polyglot-panel-live-test-sandbox-execute-the-generated-wrapp/)

## The question

#912 wants to **execute** (not just show) the per-framework wrapper that
`generateWrapper(cem, target)` emits, and render it live with runtime-error surfacing. Tracing the real
output (`fui:tools/gen-wrapper/genWrapper.mjs:119`) the React wrapper is literally:

```
import React, { useEffect, useRef } from 'react';
…
return React.createElement('<fui-tag>', { ref, …attrs }, children);
```

So a live preview needs three things that **do not exist in the workbench today**: (1) in-browser
TS+JSX transpile, (2) a React/Vue **runtime** reachable from the preview, and (3) the **real custom
element defined where the wrapper runs**. The workbench registers blocks via bundler-resolved dynamic
imports (`fui:workbench/registry.ts:149` — `import('../blocks/droplist/AutoComplete')`), which expose
**no stable per-block module URL** to re-import elsewhere. The transpiler choice (esbuild-wasm vs
Babel-standalone) is a confirmed impl detail; the two real strategy axes are **element isolation** and
**framework-runtime source**.

## Prior art surveyed

| Tool | Isolation | Transpile | Framework runtime | Notes |
|---|---|---|---|---|
| **Lit Playground** (`google/playground-elements`) | **iframe `srcdoc`** — own execution context; console captured by monkey-patching `console.*` and `postMessage`-ing to parent | in-browser TS compiler | **rewrites bare imports to CDN URLs** (`import 'lit'` → `unpkg.com/lit?module`) | The closest analog — also web-components-first. Chose iframe isolation for *executable* preview. |
| **CodeSandbox Sandpack** | iframe bundler | in-iframe bundler | CDN / bundled | Heavier; full bundler-in-iframe. |
| **StackBlitz WebContainers** | iframe + service worker | full Node-in-browser | npm install in-browser | Maximalist; far beyond this need. |
| **esm.sh / `esm.sh/tsx`** | n/a (a CDN) | edge-compiled TSX (1 KB loader) | bare-specifier import maps → `esm.sh/react@19` | The no-build runtime-source mechanism Lit-style tools point at. |
| **esbuild-wasm** | n/a | `esbuild.transform()` in a Web Worker (`initialize()` + WASM url); **does module resolution + bundling** | n/a | ~10× slower than native esbuild but the only single-call transform that also bundles. |
| **@babel/standalone** | n/a | auto-compiles `type=text/babel` scripts | n/a | **No module resolution / bundling** — weaker for our wrapper that `import`s react. |

### Load-bearing platform facts (ground the defaults)

- **Import maps are document-scoped and resolve-once.** One import map per document; once a bare
  specifier resolves, it can't be re-pointed. A fresh `<iframe srcdoc>` gets a **fresh document and
  import map per preview** — same-document mount cannot re-resolve frameworks across previews/targets.
- **`customElements.define` throws on re-definition.** A same-document sandbox cannot register a fresh
  element; it can only reuse the one the workbench already registered. An iframe gets a clean registry.
- **Executed wrapper code is framework code, not host-controlled DOM.** A thrown error in the
  transpiled wrapper that runs *same-document* can break the workbench shell itself; in an iframe it's
  contained.

## How this reshapes the two forks

1. **Element isolation (Fork A).** The Lit Playground precedent — the single closest analog, also a
   web-components-first tool — chose **iframe `srcdoc` isolation** for executable preview, precisely for
   error containment + a fresh import map per run. That, plus bias-toward-separation, moves the
   best-end-state default from the item's interim **A2 (same-document)** to **A1 (iframe)**. The genuine
   counterweight that keeps A2 a live alternative: A1 must get the element *defined inside the frame*,
   which needs a stable per-block module URL the registry doesn't expose today (real build cost in
   #912). That cost is build effort (prioritization), not a merit defect — so the fork is ruled on merit
   (A1) and the cost is filed to the build, per *fork-is-not-a-prioritization-tool*.

2. **Framework-runtime source (Fork B).** The item already establishes an **invariant**: the runtime
   must **never enter FUI's shipped bundle** (B2 = bundling react/vue into `@frontierui` is the flawed,
   excluded branch — a web-components lib shipping framework runtimes). Among the framework-free options,
   the item defaulted to **CDN import-map (esm.sh)**. But the item *also* requires an e2e plan that
   "doesn't depend on uncontrolled external network (vendor the runtimes for the test, or stub)." If
   vendoring must exist for CI anyway, CDN means maintaining **two paths** (CDN for dev + vendored for
   CI). A single **locally-vendored devDependency served into the sandbox iframe** serves dev + CI from
   one path, stays framework-free (a devDep is not the shipped bundle), and — paired with the
   already-local esbuild-wasm transpiler — makes the whole sandbox **offline + deterministic**. So the
   merit default moves to local-vendored; CDN (esm.sh) is the simpler-to-wire interim.

The two forks are **coupled**: B's framework-free isolation is cleanest when the runtime loads *inside
the iframe* (A1), not the workbench document (A2). A1 + local-vendored is the coherent combined strategy
that mirrors Lit Playground (iframe + import-map) while honoring FUI's framework-free + the offline-CI
requirement.

## Classification (per-fork pass)

- **Layer:** the sandbox is a **FUI-owned devtool** inside the workbench (`fui:workbench/`,
  `locus: frontierui`) — not a WE standard. Consistent with #809 (workbench is FUI-owned) and
  *impl-is-not-a-standard*. Nothing crosses into `@webeverything`.
- **Protocol vs impl:** no new protocol. The transpile + mount + console-capture is pure devtool impl;
  the only contract it consumes is the already-ratified Custom Elements Manifest (#626) the wrapper is
  generated from, and the #506 verdict / #891 runner for the downstream badge (#913).
- **DI seam?** No runtime DI seam — this is author/dev-time execution, not a registry the running
  standard consults (per *runtime-di-vs-devtools-provider-seam*).
- **Most-permissive default:** the transpiler stays swappable impl (esbuild-wasm recommended for module
  resolution); the isolation + runtime-source axes are ruled to best end-state above.

## Recommendation (carried to the decision)

- **Fork A → A1 (iframe `srcdoc` isolation).** ~70%. Residual: A1 needs a stable per-block module URL
  the registry doesn't expose (build cost in #912); the existing #815 "one document, no channel"
  workbench philosophy is the principled counter A2 would invoke. Flag for the decider's skeptic pass.
- **Fork B → local-vendored devDependency served into the sandbox iframe.** ~75%. Residual: esm.sh CDN
  is genuinely less wiring and is what Lit Playground ships; a decider optimizing purely for POC speed
  could reasonably take CDN. B2 (bundle into FUI) stays the ruled-out flawed branch either way.
- **Supported by default (not forks):** transpiler = **esbuild-wasm** in a Web Worker; console/error
  surfacing via the Lit-Playground **`postMessage` monkey-patch** pattern; the e2e plan reuses the same
  vendored runtime (no external network), resolving the item's e2e ask.
