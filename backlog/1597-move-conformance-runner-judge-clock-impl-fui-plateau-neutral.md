---
kind: story
size: 5
parent: "1576"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: plateau-app/src/conformance-engine/conformanceVectors.ts
tags: []
---

# Move conformance runner/judge/clock impl FUI→Plateau (neutral conformance run)

Move the executable conformance engine — runConformanceVector + judgeConformanceTrace + ConformanceVectorOracle + the VectorSample/VectorTrace trace types (fui:tools/explorer/oracles/conformanceVectors.ts) + VirtualClock (fui:tools/explorer/oracles/virtualClock.ts) — from FUI to plateau-app (the neutral conformance runner; same home as #427/#1577); re-wire fui:tools/explorer/oracles/index.ts Layer-2 export per the #1595 interim-wiring ruling. WE holds zero executable (#1282/#1566). blockedBy #1596 (interface in WE) + #1595 (interim wiring).

## Progress

Executed the move (both #1596 + #1595 resolved — design fully pre-settled).

**plateau-app (new neutral runner home `plateau:src/conformance-engine/`):** `plateau:src/conformance-engine/conformanceVectors.ts`
(runner + judge + `ConformanceVectorOracle` + `VectorSample`/`VectorTrace`) and `plateau:src/conformance-engine/virtualClock.ts`
(`VirtualClock`), the engine's unit test, **and** the deck conformance gate test (relocated per #1595 default
(c): the one Layer-2 consumer moves to plateau via the live forward edge). The engine imports the WE-owned
vector shape + binding contract (`@webeverything/conformance-vectors/{schema,binding}`) and the FUI explorer's
4-field `Finding` type over the **forward edge** (`@frontierui/tools/...`). Added the matching
`@webeverything/conformance-vectors/*` + `@frontierui/tools` aliases to `plateau:vite.config.mts` +
`plateau:vitest.config.ts` + `plateau:tsconfig.json` (lockstep). Both relocated tests pass (10 cases).

**frontierui:** deleted `fui:tools/explorer/oracles/conformanceVectors.ts` + `fui:tools/explorer/oracles/virtualClock.ts`
+ their two tests; stripped the Layer-2 re-export block from `fui:tools/explorer/oracles/index.ts` (FUI carries
zero Layer-2 in the #1597→#1577 interim). The subject binding `fui:blocks/deck/deckConformance.ts` **stays FUI** (forced by #1595),
now depending only on the WE-owned `ConformanceClock` **type** — the `VirtualClock` impl is **injected** by the
runner via a `makeClock` factory arg, so there is no FUI→plateau backward edge (the one mechanical seam #1595
left implicit; the only resolution consistent with #1282 + the forward-edge-only rule). FUI `check:standards`
clean (0 errors); deck + explorer suites pass (95 cases).

Realizes the #1576-(2) ruling (engine in the neutral runner home) and the #1566 end-state (neutral run =
Plateau). Re-composed into the operated explorer when the chrome follows at #1577.
