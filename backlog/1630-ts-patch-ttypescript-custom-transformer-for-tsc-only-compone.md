---
kind: story
size: 3
parent: "232"
status: open
priority: low
dateOpened: "2026-06-23"
tags: [component, adapters, compiler, build-tooling, strategy-axis, tsc-support, ts-patch]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# `ts-patch` / `ttypescript` custom-transformer for `tsc`-only `<component>` lowering

A deferred opt-in on the **`tsc`-support axis** established by #231 (the
[component-dc](docs/agent/platform-decisions.md#component-dc) rule). Gives bundler-refusing, **`tsc`-only**
projects actual `<component>` *lowering* (not just types) via a `ts-patch` / `ttypescript`
custom-transformer.

Held at `priority: low`: settled & valid, built **ahead of** a concrete `tsc`-only consumer rather than
gated on one (full feature surface before adoption) — just low-value-now. Picked up when there's slack or a
bundler-refusing project that needs real lowering.

- Additive: joins the `tsc`-support axis, no breakage to the #231 baseline (which ships types-only there).
- Sibling deferred opt-ins under #232: #1628 (`.component` file surface), #1629 (per-bundler-native / SWC).
