---
kind: story
size: 3
parent: "125"
status: parked
parkedReason: deferred
dateOpened: "2026-06-09"
priority: low
tags: [component, adapters, compiler, build-tooling, strategy-axis, deferred, swc, tsc]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Deferred `<component>` compiler strategy opt-ins (collected for later, on-demand)

Collection of the lower-priority strategy opt-ins set aside by the #127 ruling (the [component-dc](docs/agent/platform-decisions.md#component-dc) rule). #127 settled that the
compiler's toolchain reach is a set of **configurable strategy axes** with native-first defaults; **#231**
ships the top 2 per axis to prove the principle. These are the *remaining* legitimate-but-deferred strategies
— captured so they aren't lost, to be picked up only when a concrete project/team demands one.

## Collected opt-ins (each joins an existing axis, no breakage)

- **`.component` dedicated-file surface** — an SFC-style file holding one `<component>` (Vue `.vue` / Svelte
  `.svelte` prove it's a real end-state). Costliest to wire (a new extension every editor/bundler learns), so
  deferred until a team wants the one-element-per-file authoring model. Adds to the source-surface axis.
- **Per-bundler-native integration** — a richer per-toolchain plugin (incl. a Rust/WASM **SWC** plugin for
  Next/Turbopack) beyond the universal pre-transform baseline. Only worth it if heavy-SWC adoption demands
  native-depth integration. Adds to the toolchain-depth axis.
- **`ts-patch` / `ttypescript` custom-transformer** — gives bundler-refusing **`tsc`-only** projects actual
  `<component>` lowering (not just types). Adds to the `tsc`-support axis; ship only on demand.

## Notes

- None of these block #231 — each is an additive opt-in on an axis #231 establishes.
- The config-surface question (a Technical Configurator domain that selects strategies, data-driven) lives in
  **#150** (the [project-protocol-bar](docs/agent/platform-decisions.md#project-protocol-bar) rule), not here.
- Sibling to #227 (the [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default) rule; auto-define strategy axis), which has its own deferred-strategy space.
