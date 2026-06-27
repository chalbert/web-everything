---
kind: story
size: 3
parent: "232"
status: resolved
priority: low
locus: frontierui
graduatedTo: frontierui/compiler/src/component-transform/ts-transformer.ts
dateOpened: "2026-06-23"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
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

## Progress (batch-2026-06-26-1806-1825)

Built in the FUI compiler (impl lives in `fui:compiler/`, not WE per the zero-impl rule), so `locus` was
corrected `webeverything → frontierui`. Added a `ts-patch`/`ttypescript` custom transformer that re-wraps the
**same shared `compile()` core** as the bundler wrappers (no core re-implementation):

- `fui:compiler/src/component-transform/ts-transformer.ts` — default-export program-transformer
  `(program, config) → TransformerFactory<SourceFile>`. Reads `sourceFile.getFullText()`, runs `compile()`
  (default `surfaces: ['tsx']` — the only surface `tsc` itself processes), and on a match re-parses the
  lowered text into the SourceFile `tsc` type-checks + emits. Lowering errors throw (fail the build, like the
  webpack loader). `surfaces` overridable via the plugin config; `program` is unused (pure source rewrite).
- Exported from `fui:compiler/src/component-transform/index.ts` as `componentTsTransformer`; package subpath
  export `@frontierui/compiler/ts-transformer` added (mirrors `./webpack-loader`).
- `fui:compiler/src/component-transform/STRATEGY-AXES.md` — "tsc-only consumers" section rewritten with the
  `tsconfig` `plugins` wiring snippet.
- Tests: `fui:compiler/__tests__/component-transform/ts-transformer.test.ts` (4) — asserts byte-identical
  lowering to the canonical class, no-op on unmatched files, and the `surfaces` override. 4/4 green; `tsc
  --noEmit` clean.

Remaining #232 opt-ins: #1629 (per-bundler SWC-native) + arbitrary-string scanning.
