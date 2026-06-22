---
kind: decision
parent: "1576"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: 1597
codifiedIn: one-off
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-interim-fui-explorer-layer2-wiring.md
tags: [conformance, explorer, plateau, "1566", "1576", "1597"]
---

# Interim FUI explorer Layer-2 wiring once the conformance engine moves to Plateau (before #1577)

The backward-edge fork #1566 left open: when **#1597** moves the conformance runner/judge **impl**
FUI→Plateau but the explorer is still FUI-resident (#1577 `blockedBy` #1576), how does the FUI side keep
its Layer-2 semantic-conformance signal without a forbidden FUI→plateau-app dependency? **Real
product-behavior call (#608); blocks #1597.** Prepared 2026-06-22 — grounding overturned the original
default; full digest in
[the report](../reports/2026-06-22-interim-fui-explorer-layer2-wiring.md). Already-researched ground:
links [`/research/devtool-placement-constellation/`](/research/devtool-placement-constellation/) (#1565)
+ [`/research/data-table-conformance-after-backend-delete/`](/research/data-table-conformance-after-backend-delete/)
(#1566); no new web survey.

**RATIFIED 2026-06-22 — default (c).** Move the deck conformance test to plateau-app with the engine
(forward edge); FUI keeps zero Layer-2 in the interim; re-composed at #1577. Unblocks #1597.

## What you have to decide

After #1597 removes the executable engine from FUI, where does the FUI side's single Layer-2 consumer
run during the #1597→#1577 interim — **ratify moving it to Plateau via the live forward edge** (the
recommended default), or override toward a FUI-local engine copy.

## Grounding digest

The original framing ("how does FUI **explore-mode** obtain semantic-conformance findings, (i) internal
unit test vs (ii) thin shim") rested on assumptions grounding falsified:

- **No live explorer run consumes Layer-2.** `fui:tools/explorer/exploreAndAudit.ts:53,64` wires only
  Layer-1 (`new OracleBus(opts.oracles)`) + an optional Layer-3 `judge`. The Layer-2
  `ConformanceVectorOracle` is re-exported at `fui:tools/explorer/oracles/index.ts:45-50` but **never
  instantiated in any explore/gate path** — "surfaces in explore mode"
  (`fui:tools/explorer/oracles/index.ts:11`) is aspirational, not built. "FUI explore-mode Layer-2
  findings" is **vapor today**; dropping that ambition loses zero live coverage.
- **The engine's ONLY live consumer is one FUI unit test.**
  `fui:blocks/deck/__tests__/deck.conformance.test.ts:24` —
  `new ConformanceVectorOracle(suite, new DeckConformanceBindingFactory(document))`, asserting zero
  findings against the WE deck vector suites.
- **The engine is tiny, generic, pure.** `fui:tools/explorer/oracles/conformanceVectors.ts` (190 LOC) +
  `fui:tools/explorer/oracles/virtualClock.ts` (98 LOC) carry **only `import type`** (zero runtime deps;
  sole coupling = the 4-field `Finding` in `fui:tools/explorer/oracles/observation.ts`). Purity argues
  *for* a single home, not duplication.
- **The forward edge is live; the backward edge is the only forbidden one.** WE→FUI→plateau-app; FUI
  imports nothing from plateau (verified). But `plateau:src/main.ts:10,67,71` already imports FUI
  (`@frontierui/plugs/bootstrap`, `@frontierui/blocks/navigation`, …) — so Plateau importing
  `@frontierui/blocks/deck`'s `DeckConformanceBindingFactory` bends no rule.
- **The deck test IS the neutral run, currently mis-homed.** Unlike data-table (a *separate* FUI-native
  `applyPipeline` recompute oracle — a different question, #1566 Fork 2a), the deck test runs the SHARED
  engine over WE vectors — that *is* the neutral conformance run #1566 places in Plateau. Relocating it
  *realizes* #1566, it does not violate it.
- **#1597 already lands the engine in Plateau**; #1596 already moves the `ConformanceBinding` interface
  FUI→WE; #872 is the eventual published-package de-dup.

## The axis

The genuine axis is **where the single remaining executable consumer runs once the engine it depends on
has left FUI for Plateau (#1597), during the window before the operated explorer itself follows (#1577).**
A "thin shim" calling Plateau is excluded — not because a call is *categorically* a forbidden import edge
(a cross-origin/CLI boundary à la #1499 would not be one), but because **there is no operated Plateau run
to call in this window** (the engine lands as a library at #1597; the operated explorer product moves only
at #1577, which is blocked by this decision). That leaves a clean either/or: keep a FUI-local engine copy
so the deck self-check stays in-repo (the #1566 verbatim-copy interim pattern), or **move the one consumer
to Plateau via the already-live forward edge** so there is a single engine home. The #1566 copy pattern was
justified by a *backward* edge that does not exist here, so it does not transfer; and a FUI-local
*executable* neutral-run engine would re-instate exactly the second neutral-run home #1566 pushed to
Plateau.

## Recommended path at a glance

| Fork | Question | Recommended default | Main alternative (excluded) |
|------|----------|---------------------|------------------------------|
| 1 | Where does the FUI side's one Layer-2 consumer (the deck conformance test) run during the #1597→#1577 interim? | **(c) Move the deck conformance test to plateau-app with the engine (forward edge); FUI keeps zero Layer-2 in the interim; re-composed at #1577** | **(b) Thin FUI shim → a Plateau run** — premature (no operated run/boundary in the window); a backward edge if done as an import. *(coherent runner-up: (a) FUI-local engine copy — loses on duplication + re-instates a second neutral-run home)* |

**Supported by default / forced (not forks):** the `fui:tools/explorer/oracles/index.ts` Layer-2
re-export block is **removed** (the engine + trace types leave FUI; `ConformanceBinding`/`Factory` types
already left to WE at #1596) — forced by #1597. `fui:blocks/deck/deckConformance.ts` (the binding =
subject adapter) **stays FUI**, re-pointing its `ConformanceBinding` type import to WE per #1596 — forced.
The relocated deck test imports Plateau's engine + WE's vector suites + `@frontierui/blocks/deck`'s
`DeckConformanceBindingFactory` (forward edge).

## Fork 1 — Where does the one Layer-2 consumer run during the interim?

*Fork-existence:* the engine must live in exactly one place after #1597, and the one test that runs it
can execute in exactly one repo — a genuine either/or. The framed shim branch (b) is the *broken/excluded*
one: there is no operated Plateau conformance run to call in the #1597→#1577 window (engine lands as a
library at #1597; the operated explorer moves at #1577, blocked by this), so a shim wires FUI to a
nonexistent run — and as a code import it would be the forbidden backward edge. The live contest is
(c) move-the-test-to-Plateau vs (a) keep-a-FUI-local-copy.

- **(c) Move the deck conformance test to plateau-app with the engine — the default.** #1597 takes the
  engine *and* its one consumer to Plateau. The relocated test imports Plateau's engine + WE's deck vector
  suites + `@frontierui/blocks/deck`'s `DeckConformanceBindingFactory` over the **already-live forward
  edge** (`plateau:src/main.ts:10,67,71`), and keeps asserting zero findings as the neutral deck
  conformance gate. FUI carries no Layer-2 engine or consumer in the interim; it is re-composed into the
  operated explorer when the chrome moves to Plateau (#1577). **One engine home; the #1566 end-state
  (neutral run = Plateau) reached directly; zero live coverage lost** (the gate relocates with the
  engine, it does not disappear).
- **(a) FUI keeps a local verbatim copy of the engine; the deck test stays in FUI.** Coherent — mirrors
  the #1566 cases/goldens verbatim-copy interim (canonical elsewhere, de-duped by #872) and preserves a
  fast in-repo deck self-check. But the #1566 copy pattern was forced by a *backward* edge that is **absent
  here**, the engine's zero-runtime-dep purity makes a single import home trivial, and a FUI-local
  *executable* neutral-run engine re-instates the second neutral-run home #1566 explicitly pushed to
  Plateau. A weaker interim that buys a self-check #1566 says belongs in Plateau anyway.
- **(b) Thin FUI shim calling a Plateau run — excluded.** No operated Plateau run/boundary exists in the
  window; done as a code import it is the forbidden FUI→plateau-app backward edge. (A cross-origin/CLI
  shim only becomes both possible and non-backward once the operated run exists — i.e. at #1577, which is
  out of this interim's scope.)

**Default: (c).** Realizes #1566's neutral-run-in-Plateau end-state in one move, over an edge the
constellation already runs, with no FUI-resident executable and no duplicate engine — and it keeps #1597
a clean "move," not a "copy + keep."

*Residual:* whether FUI later wants a *fast local* conformance signal for its own deck edits (vs relying
on Plateau's CI) is a downstream developer-ergonomics detail, addressable via the #872 published-package
path — not part of this bounded interim.

Skeptic (prepare-phase): REFUTED the original default (FUI-local copy / "drop to internal unit test") →
flipped to **(c) move the test to Plateau**. The copy rationale needs a backward edge that isn't present;
the engine's verified purity argues for one home; a FUI-local executable re-instates the second
neutral-run home #1566 removed. SURVIVES-WITH-AMENDMENT on the shim exclusion: re-based "forbidden edge"
→ "no operated Plateau run/boundary in the window; zero live coverage lost." A new shared executable
package was also rejected — it loses to the planned #872 path. Folded in full.

## Blocks

- **#1597** (move conformance runner/judge/clock impl FUI→Plateau) — `blockedBy` this. On ratification,
  #1597 also (i) removes the `fui:tools/explorer/oracles/index.ts` Layer-2 re-export block and (ii) moves
  `fui:blocks/deck/__tests__/deck.conformance.test.ts` to plateau-app per default (c).
- **#1576** (umbrella epic) — this is its carved interim-wiring decision.
- **#1577** (explorer CLI chrome → Plateau) — re-composes an operated Layer-2 into the Plateau explorer;
  after it, a cross-origin/CLI explorer→run shim becomes possible and non-backward (out of scope here).
