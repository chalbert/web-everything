---
type: decision
workItem: story
size: 2
parent: "125"
status: open
dateOpened: "2026-06-06"
tags: [component, adapters, packaging, build-tooling, swc, typescript]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Decide how far the `<component>` compiler reaches across toolchains

The `<component>` → custom-element transform is a build-time plugin that re-wraps cleanly per bundler
(Vite/esbuild/Rollup/webpack/Babel), but three toolchain questions from report §7 don't have a single
mechanical answer — each is a fork to settle before the compiler's surface is finalized:

- **SWC / Next.js / Turbopack** — SWC plugins are Rust/WASM, so our JS compiler can't be a native SWC
  plugin. *Recommendation:* run the compiler as a **pre-transform** step (let SWC see plain output);
  revisit a Rust port only if Next/Turbopack adoption demands it.
- **`<component>` source surface** — a dedicated `.component` file type vs. inline `<component>` inside
  `.html`/template strings vs. inside `.tsx`. This choice sets every plugin's match rule, so it must be
  decided once. *Open — no recommendation yet.*
- **`tsc`-only consumers** — `tsc` does JSX/types but no custom transforms, so a `tsc`-only project gets
  types but no `<component>` lowering. *Recommendation:* document "a bundler is required" first; consider
  shipping a `tsc` custom-transformer (via `ts-patch`/`ttypescript`) only if demand appears.

Depends on the package extraction (#125). The source-surface question is the one genuinely open fork; the
SWC and `tsc` questions are ratify-the-recommendation calls.
