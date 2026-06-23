---
kind: story
size: 3
parent: "232"
status: open
priority: low
dateOpened: "2026-06-23"
tags: [component, adapters, compiler, build-tooling, strategy-axis, source-surface, sfc]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# `.component` dedicated-file surface for `<component>` (one-element-per-file SFC authoring)

A deferred opt-in on the **source-surface axis** established by #231 (the
[component-dc](docs/agent/platform-decisions.md#component-dc) rule). Adds an SFC-style `.component` file
holding one `<component>` — Vue `.vue` / Svelte `.svelte` prove this is a real end-state authoring model.

Costliest of the source-surface opt-ins to wire (a new extension every editor / bundler / language-server
has to learn), so it sits at `priority: low` — settled & valid, built **ahead of** a concrete consumer (we
want the full feature surface complete before adoption, not gated on it), just low-value-now. Picked up when
there's a slack window or a team that wants the one-element-per-file model.

- Additive: joins the source-surface axis, no breakage to the #231 baseline.
- Sibling deferred opt-ins under #232: #1629 (per-bundler-native / SWC), #1630 (`tsc`-only transformer).
