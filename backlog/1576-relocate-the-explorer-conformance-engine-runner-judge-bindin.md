---
kind: epic
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-24"
graduatedTo: none
tags: [conformance, explorer, plateau, "1566", "1565"]
---

# Relocate the explorer conformance engine — interface → WE, runner/judge impl → Plateau

**Umbrella epic** (sliced 2026-06-22 from a `story/13`, see
[we:reports/2026-06-22-backlog-split-analysis.md](../reports/2026-06-22-backlog-split-analysis.md) Run 10).
The engine relocates in two deliverable moves plus one carved decision: **#1596** moves the
`ConformanceBinding` interface FUI→WE (root, batchable), **#1597** moves the runner/judge/clock impl
FUI→Plateau (`blockedBy` #1596 + #1595), and **#1595** rules the interim FUI explorer Layer-2 wiring (the
backward-edge fork #1566 left open). #1355 + #1531 re-point their `blockedBy` to **#1597**.

**Re-pointed 2026-06-22 by #1566** (which amends the original #1565 Fork-3 "engine → WE" framing). The
conformance engine splits **three** ways, not two:

1. **Declarative contract → WE.** The `ConformanceBinding` **interface** + the vector/golden **corpus** +
   the golden **schema** move to a WE home (`@webeverything/conformance-vectors`, type/data sub-path). This
   is the standard's *definition* of conformance (reads output as DATA, #1467/#817/WPT) — it must define
   how ANY WE implementer is tested.
2. **Runner + judge *implementation* → Plateau.** The generic `runConformanceVector` runner + pure
   `judgeConformanceTrace` + `VirtualClock` move from `fui:tools/explorer/oracles/conformanceVectors.ts` to
   **Plateau** (the neutral conformance runner; same home as the #427 dashboard / #1577 explorer product) —
   **not WE.** Judging is executable and WE holds zero executable (#1282); neutrality is satisfied by
   Plateau (a non-implementer), not by WE.
3. **Concrete bindings → each implementer.** FUI's `fui:blocks/*/...Conformance.ts` bindings stay in FUI
   (FUI is one *target*), re-pointing their interface import to WE (WE→FUI; #700/#872). A customer/3rd-party
   implementer ships its own binding.

This is what makes the conformance run testable against ANY WE implementer from a neutral home. Likely
**sub-splits**: (a) the WE interface+vectors+schema move, (b) the Plateau runner/judge-impl move. Governed
by [we:docs/agent/platform-decisions.md#devtools-placement](../docs/agent/platform-decisions.md#devtools-placement)
(amended).

## Pre-flight (batch-2026-06-22-1581-1582-1576-1355-1531) — NOT a clean size-5; needs /slice + surfaces a backward-edge fork → size 5 → 13

Grounded the real code surface: the engine is `fui:tools/explorer/oracles/conformanceVectors.ts` (190 LOC:
`runConformanceVector` runner + pure `judgeConformanceTrace` + `ConformanceBinding` interface +
`ConformanceVectorOracle` class) plus `fui:tools/explorer/oracles/virtualClock.ts` (98 LOC). The vector
**schema** is **already** WE-owned (`@webeverything/conformance-vectors/schema`, imported type-only). Consumed
by `fui:tools/explorer/oracles/index.ts` (re-exported as Layer-2) + its test.

**Two reasons it is not the clean size-5 the selector packed:**

1. **It bundles ≥3 independently-deliverable cross-repo moves** (the body's own "likely sub-splits"): (a) the
   `ConformanceBinding` **interface** → WE (next to the already-WE schema); (b) the runner + judge impl +
   `VirtualClock` + `ConformanceVectorOracle` → **Plateau**; (c) re-point FUI's concrete bindings + oracle
   index. That is /slice territory, not one batch slice — **re-sized 5 → 13**.
2. **A genuine backward-edge design fork #1566 left open** — now carved into **#1595** (`kind:decision`,
   blocks #1597). #1566 ruled the runner/judge impl → **Plateau**, but the explorer that consumes Layer-2 is
   **FUI-resident** and `fui:tools/explorer/oracles/index.ts` composes it inline; the constellation is
   WE→FUI→plateau-app (**FUI must not import from plateau-app** — verified: it imports nothing from plateau
   today), and **#1577 (explorer chrome → Plateau) is `blockedBy` THIS** — so the explorer is *not* in
   Plateau yet when #1597 lands. See **#1595** for the interim-wiring fork ((i) drop FUI Layer-2 to an
   internal unit test [default] vs (ii) thin FUI shim calling the Plateau run). **Do NOT pick one to force
   batchability** (#608) — it is a real product-behavior call.

**Sliced 2026-06-22** into: **#1596** (WE-interface move — clean, no fork, root/batchable), **#1597**
(Plateau runner/judge move — `blockedBy` #1596 + #1595), **#1595** (the interim Layer-2 wiring decision,
default (i): drop FUI explorer Layer-2 to an internal unit test for the #1576→#1577 interim). #1355 + #1531
(was `blockedBy 1576`) re-point to **#1597**.
