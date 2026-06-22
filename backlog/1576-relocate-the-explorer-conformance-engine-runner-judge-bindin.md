---
kind: story
size: 5
status: active
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
tags: [conformance, explorer, plateau, "1566", "1565"]
---

# Relocate the explorer conformance engine — interface + vectors → WE, runner/judge impl → Plateau

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
