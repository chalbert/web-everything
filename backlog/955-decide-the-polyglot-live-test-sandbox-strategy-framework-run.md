---
type: decision
workItem: story
size: 3
status: open
locus: frontierui
relatedProject: webdocs
parent: "746"
dateOpened: "2026-06-18"
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Decide the polyglot live-test sandbox strategy (framework-runtime loading + element isolation)

Surfaced claiming **#912** (live-test sandbox) in batch-2026-06-18. #912 transpiles + **executes** the
consume-mode wrapper `generateWrapper(cem, target)` produces. Tracing the real output shows that's a much
bigger build than the `story·5` estimate, and it carries a genuine strategy fork:

- The generated wrapper is **TypeScript + JSX that `import`s `react`** (verified via
  `fui:tools/gen-wrapper/genWrapper.mjs`) and renders the **real custom element** (`<fui-…>`). So a live
  preview needs (1) in-browser TS+JSX transpile, (2) a React/Vue **runtime**, and (3) the **actual element
  defined in the sandbox** — but the workbench registers elements via *bundled static imports*
  (`fui:workbench/registry.ts:148` `import('../blocks/…').then(register…)`), with no reusable per-block
  module URL to re-import into an isolated frame. No in-browser transpile/sandbox infra exists today.

The transpiler choice (esbuild-wasm vs Babel-standalone) **is** a mere impl detail (the body says so). The
two things that aren't:

## Fork A — element isolation

- **A1 — Isolated `<iframe srcdoc>`** with its own import-map; re-import the element module + frameworks
  into the frame. Clean error/runtime containment, but must resolve the element's dev-served module URL
  (the registry doesn't expose one) and re-register per preview.
- **A2 — Same-document mount** reusing the already-registered parent element. Simple, but the framework
  runtime pollutes the workbench page and errors aren't contained. **(bold default for a POC** — simplest
  path to a live render; revisit isolation if it proves leaky.)

## Fork B — framework-runtime loading

- **B1 — CDN import-map (esm.sh) in the sandbox (bold default).** Keeps FUI **framework-free** (React/Vue
  load only inside the dev-tool sandbox, never in FUI's shipped bundle) — aligns with the workbench being a
  zero-lock-in devtool. Cost: a network dependency for the preview (offline dev + CI-e2e verifiability).
- **B2 — Bundle React/ReactDOM/Vue into FUI.** No network dependency, but **conflicts with FUI's
  framework-free principle** (a web-components lib shipping framework runtimes) and bloats the bundle —
  the branch the fork-existence test flags as flawed.

Also confirm an **e2e verification plan** that doesn't depend on uncontrolled external network (vendor the
runtimes for the test, or stub) — live-mount can't be unit-tested in jsdom.

Note the related ruling on **#954** already places the #891-behavioral conformance badge (#913 part 2)
**downstream of #912** — so this sandbox is on the critical path for behavioral conformance too.

**Blocks #912** (`blockedBy: 955` added; also re-sized 5 → 8). Sibling of #753/#818/#913 under #746.
