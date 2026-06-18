---
type: idea
workItem: story
size: 8
parent: "746"
status: open
blockedBy: ["753", "955", "977"]
dateOpened: "2026-06-18"
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
