# Interim FUI explorer Layer-2 wiring once the conformance engine moves to Plateau (#1595 prep)

**Date:** 2026-06-22 · **Item:** #1595 (`kind: decision`, parent #1576, blocks #1597) · **Status:** prepared (ready to ratify)

Prepares the backward-edge fork #1566 left open: when #1597 moves the conformance runner/judge **impl**
FUI→Plateau, but the explorer is still FUI-resident (#1577 `blockedBy` #1576), how does the FUI side keep
its Layer-2 semantic-conformance signal without a forbidden FUI→plateau-app dependency? Already-researched
ground — links the [`/research/devtool-placement-constellation/`](/research/devtool-placement-constellation/)
(#1565) + [`/research/data-table-conformance-after-backend-delete/`](/research/data-table-conformance-after-backend-delete/)
(#1566) topics and [#1566's report](2026-06-22-data-table-conformance-after-backend-delete.md); no new web
survey. The grounding below **reshaped the item's framing** (the original default was overturned).

## Grounding digest (the verified facts)

- **The executable engine has exactly ONE live consumer in FUI — a unit test.**
  `fui:blocks/deck/__tests__/deck.conformance.test.ts:24` does
  `new ConformanceVectorOracle(suite, new DeckConformanceBindingFactory(document))` and asserts zero
  findings against the WE deck vector suites — FUI's in-repo self-check that its deck conforms.
- **No live explorer run consumes Layer-2.** `fui:tools/explorer/exploreAndAudit.ts:53,64` wires only
  Layer-1 (`new OracleBus(opts.oracles)`) + an optional Layer-3 advisory `judge`. The
  `ConformanceVectorOracle` (Layer-2) is re-exported by `fui:tools/explorer/oracles/index.ts:45-50` but
  is **never instantiated in any explore/gate path** — the "surfaces in explore mode" doc comment
  (`fui:tools/explorer/oracles/index.ts:11`) is aspirational, not built. So "FUI explore-mode Layer-2
  findings" is **vapor today**.
- **The engine is tiny, generic, and pure.** `fui:tools/explorer/oracles/conformanceVectors.ts` (190 LOC)
  + `fui:tools/explorer/oracles/virtualClock.ts` (98 LOC) carry **only `import type`** statements (zero
  runtime deps); the sole local coupling is the 4-field `Finding` interface
  (`fui:tools/explorer/oracles/observation.ts`). Purity is an argument *for* a single home (trivially
  importable), not for duplication.
- **The constellation DAG forbids the backward edge — but the FORWARD edge is live and routine.**
  WE→FUI→plateau-app; FUI imports nothing from plateau (verified). But plateau-app already imports FUI
  as a matter of course: `plateau:src/main.ts:10,67,71` (`@frontierui/plugs/bootstrap`,
  `@frontierui/blocks/navigation`, …). So **Plateau importing `@frontierui/blocks/deck`'s
  `DeckConformanceBindingFactory` is the same allowed direction** — no rule is bent.
- **The deck "self-check" is itself the neutral run, currently mis-homed in FUI.** Unlike data-table
  (which has a *separate* FUI-native `applyPipeline` recompute oracle — a different question), the deck
  test runs the SHARED engine over WE vectors. That IS the neutral conformance run #1566 places in
  Plateau — it is not a distinct FUI-internal question, so relocating it to Plateau *realizes* #1566
  rather than violating it.
- **#1597 already lands the engine in Plateau** (`runConformanceVector` + `judgeConformanceTrace` +
  `ConformanceVectorOracle` + `VirtualClock` + trace types). #1596 moves the `ConformanceBinding`
  interface FUI→WE. #872 is the eventual published-package de-dup path.

## How the grounding reshaped the forks

The item framed a binary: (i) drop FUI Layer-2 to an internal unit test [default] vs (ii) a thin FUI
shim calling the Plateau run. Grounding overturned **both** the framing and the default:

1. **(ii)'s stated exclusion was wrong.** A "thin shim" is *not* categorically a forbidden import edge —
   a cross-origin / CLI / subprocess boundary (cf. WE #1499) would not create a module edge. The honest
   reason to exclude it is **prematurity**: there is no *operated* Plateau conformance run to call in the
   #1597→#1577 window (the engine lands as a library at #1597; the operated explorer product doesn't move
   until #1577, which is blocked by this decision). And dropping the Layer-2 "ambition" loses **zero**
   live coverage, because no explorer run consumes it today.
2. **A better third option the framing missed.** The one real consumer (the deck conformance test) can
   simply **move to Plateau with the engine**, via the already-live `plateau → @frontierui/*` forward
   edge — yielding a single engine home, no FUI-local duplicate, and the #1566 end-state (neutral run =
   Plateau) reached directly. The #1566 *verbatim-copy* interim pattern (keep a local copy) was justified
   by a *backward* edge that **does not exist here** — so it does not transfer.

Net: one fork, three options, default = **move the deck conformance test to Plateau** (option (c)).

## Skeptic pass (prep-phase, ran to refute)

- **Fork 1 framing** → SURVIVES-WITH-AMENDMENT: internal-only-for-the-window conclusion holds, but
  re-base the exclusion of the shim from "forbidden edge" to "no operated Plateau run/boundary exists in
  this window; zero live coverage lost." Folded in.
- **Original default (i)/(a) FUI-local engine copy** → REFUTED: the copy rationale needs a backward edge
  that isn't present; the engine's verified zero-runtime-dep purity argues for one home; a FUI-local
  *executable* neutral-run engine re-instates the second neutral-run home #1566 pushed to Plateau.
  Flipped the default to **move the test to Plateau** (forward edge). A new shared executable package was
  also rejected — it loses to the already-planned #872 path.

## Consequences for #1597 (so it can execute the ruling)

- `fui:tools/explorer/oracles/index.ts` — **remove the Layer-2 re-export block**
  (`fui:tools/explorer/oracles/index.ts:36-50`); the engine + its trace types leave FUI (the
  `ConformanceBinding`/`Factory` types already left to WE at #1596). Nothing Layer-2 remains FUI-resident.
- `fui:blocks/deck/__tests__/deck.conformance.test.ts` — **move to plateau-app**; it imports Plateau's
  relocated engine + WE's vector suites + `@frontierui/blocks/deck`'s `DeckConformanceBindingFactory`
  (forward edge) and keeps asserting zero findings as the neutral deck conformance gate.
- `fui:blocks/deck/deckConformance.ts` — stays FUI (the binding = subject adapter); re-points its
  `ConformanceBinding` type import to WE per #1596.
- FUI carries **no** Layer-2 engine or consumer in the interim; it is re-composed into the operated
  explorer when the chrome moves to Plateau (#1577).
