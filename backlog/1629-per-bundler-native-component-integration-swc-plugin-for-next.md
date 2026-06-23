---
kind: story
size: 5
parent: "232"
status: open
priority: low
dateOpened: "2026-06-23"
tags: [component, adapters, compiler, build-tooling, strategy-axis, toolchain-depth, swc]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Per-bundler-native `<component>` integration (Rust/WASM SWC plugin for Next/Turbopack)

A deferred opt-in on the **toolchain-depth axis** established by #231 (the
[component-dc](docs/agent/platform-decisions.md#component-dc) rule). Adds a richer per-toolchain plugin —
notably a Rust/WASM **SWC** plugin for Next/Turbopack — beyond the universal pre-transform baseline #231
ships.

Held at `priority: low`: native-depth integration is only *worth its weight* under heavy-SWC adoption, but
we build the full feature surface **ahead of** that consumer rather than gating on it — so this stays a
valid, pickable item, just low-value-now. Picked up when there's slack or a heavy-SWC project to validate
the native depth against.

- Additive: joins the toolchain-depth axis, no breakage to the #231 universal pre-transform baseline.
- Sibling deferred opt-ins under #232: #1628 (`.component` file surface), #1630 (`tsc`-only transformer).
