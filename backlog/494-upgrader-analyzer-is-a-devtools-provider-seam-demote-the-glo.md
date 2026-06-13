---
type: issue
workItem: task
parent: "097"
status: open
dateOpened: "2026-06-13"
tags: []
---

# Upgrader analyzer is a devtools provider seam — demote the global singleton, fix the runtime-registry kinship comment

Spun out of #191's reframe. The upgrader's analyzer seam (`CustomAnalyzerRegistry` / `analyzerRegistry`, upgraderEngine.ts) is DEVTOOLS — consulted once by a tool at author/migration time, never inside a running app. It is NOT the same kind of thing as the runtime standard registries `CustomRenderStrategyRegistry` (#052) / `CustomCompilerRegistry` (#081), which the project injects into for the running standard to consult. Two cleanups: (1) correct the doc comment (upgraderEngine.ts:13-16) that markets it as 'the SAME inject-a-provider shape as Custom*Registry'; (2) demote the global mutable singleton to explicit provider injection (the engine already accepts `opts.registry`) — a devtools takes its providers as input, not from a global. Orthogonal to the #491-493 builds; do anytime.
