---
kind: story
size: 5
status: open
locus: frontierui
blockedBy: ["1363"]
dateOpened: "2026-06-21"
relatedProject: webisolation
tags: [webisolation, css-isolation, frontierui, build-transform, adapters]
---

# webisolation L2: bundler adapter family — thin shims (vite/rspack/webpack/esbuild/rollup) over the pure core

Ship the per-bundler adapter family that hosts the #1363 pure `@scope`→unique-class lowering core, so a
project can apply webisolation L2 with **its own bundler** — explicitly including consuming FUI's
**uncompiled source with rspack, without Vite** (the ratified requirement). Thin shims over one pure
PostCSS core (the trait-enforcer distribution shape — `fui:tools/trait-enforcer/` already ships
vite/esbuild/rollup/webpack/parcel plugins over pure functions): **vite, rspack, webpack, esbuild,
rollup**, none privileged. Per the [standard-consumability](../docs/agent/platform-decisions.md#standard-consumability)
ruling (#1377): contract+conformance stay WE; this reference transform + adapters are published
impl/tooling (FUI-owned, zero-lock-in), never `@webeverything`. Which adapter ships first is prioritization,
not scope — the end-state is the full family.

## Acceptance

- A pure, bundler-agnostic lowering core (from #1363) is wrapped by a thin adapter for each of **vite,
  rspack, webpack, esbuild, rollup** — each ≤ a thin shim, no logic forked from the core.
- A sample project consumes FUI's **uncompiled** block source and applies L2 isolation **via rspack with
  no Vite in the toolchain** (the explicit no-lock-in requirement).
- Adapters published as zero-lock-in tooling (not `@webeverything`); scope-key naming is a config option,
  not bespoke per-adapter logic.
