---
type: issue
workItem: task
parent: "097"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: []
---

# Upgrader analyzer is a devtools provider seam — demote the global singleton, fix the runtime-registry kinship comment

Spun out of #191's reframe. The upgrader's analyzer seam (`CustomAnalyzerRegistry` / `analyzerRegistry`, we:upgraderEngine.ts) is DEVTOOLS — consulted once by a tool at author/migration time, never inside a running app. It is NOT the same kind of thing as the runtime standard registries `CustomRenderStrategyRegistry` (#052) / `CustomCompilerRegistry` (#081), which the project injects into for the running standard to consult.

Two cleanups: (1) correct the doc comment (we:upgraderEngine.ts:13-16) that markets it as 'the SAME inject-a-provider shape as Custom*Registry'; (2) demote the global mutable singleton to explicit provider injection (the engine already accepts `opts.registry`) — a devtools takes its providers as input, not from a global. Orthogonal to the #491-493 builds; do anytime.

## Progress

Resolved 2026-06-13. Both cleanups landed in [we:upgraderEngine.ts](../blocks/renderers/upgrader/upgraderEngine.ts):

1. **Kinship doc-comment corrected** — the module header now states the analyzer is a DEVTOOLS seam
   consulted once by a tool at author/migration time, explicitly *contrasted* with the runtime standard
   registries `CustomCompilerRegistry` (#081) / `CustomRenderStrategyRegistry` (#052) that a running
   app/standard consults at render time. The "SAME inject-a-provider shape as Custom*Registry" marketing
   line is gone.
2. **Global singleton demoted** — deleted `export const analyzerRegistry`. `UpgradeOptions.registry` is
   now **required** and `upgrade(input, opts)` reads `opts.registry` directly (no `?? analyzerRegistry`
   fallback). A devtools takes its providers as explicit input. No caller relied on the global — the demo
   and every test already construct their own `new CustomAnalyzerRegistry()` and inject it; only the
   empty-registry diagnostic message + one test assertion needed updating.

Gate: `check:standards` green; upgrader unit suites pass (58 passed, 2 skipped).
