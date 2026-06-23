---
kind: epic
parent: "125"
status: open
dateOpened: "2026-06-09"
tags: [component, adapters, compiler, build-tooling, strategy-axis, deferred, swc, tsc]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Deferred `<component>` compiler strategy opt-ins (umbrella)

**Epic (re-typed 2026-06-22 — was mis-filed `kind: decision`):** no merit fork here. #127 settled the
compiler's toolchain reach as **configurable strategy axes** with native-first defaults; **#231** shipped
the top-2-per-axis baseline. The three opt-ins below each join a **different** axis, are additive, and break
nothing — *support-all*, not branches of a fork. "Which to build / on what trigger" is pure prioritisation,
and a fork is never a prioritisation tool. So this is an **epic of low-priority build slices**, each built
**ahead of** a concrete consumer (full feature surface before adoption, not gated on it), held at
`priority: low` until there's a slack window.

## Child slices (each joins an existing axis, no breakage)

- **#1628 — `.component` dedicated-file surface** — SFC-style file holding one `<component>` (Vue `.vue` /
  Svelte `.svelte` prove the end-state). Source-surface axis.
- **#1629 — per-bundler-native integration** — richer per-toolchain plugin incl. a Rust/WASM **SWC** plugin
  for Next/Turbopack. Toolchain-depth axis.
- **#1630 — `ts-patch` / `ttypescript` custom-transformer** — real `<component>` *lowering* for
  bundler-refusing **`tsc`-only** projects. `tsc`-support axis.

## Notes

- None of these block #231 — each is an additive opt-in on an axis #231 establishes.
- The config-surface question (a Technical Configurator domain that selects strategies, data-driven) lives in
  **#150** (the [project-protocol-bar](docs/agent/platform-decisions.md#project-protocol-bar) rule), not here.
- Sibling to #227 (the [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default) rule; auto-define strategy axis), which has its own deferred-strategy space.
