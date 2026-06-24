---
kind: decision
status: open
dateOpened: "2026-06-24"
relatedProject: webcomponents
tags: [explorer, devtools-placement, constellation, plateau, frontierui, cross-repo]
---

# Decide the Plateau explorer-product-surface ↔ FUI-explorer-engine boundary (the @frontierui public API the moved CLI imports) + the Layer-1 genericInvariants home

#1577 (relocate the explorer CLI chrome / orchestration / report-bundling FUI → Plateau per #1565 Fork 3) cannot proceed as a mechanical move — it needs a cross-repo boundary that does not exist. The four product-surface files (`fui:tools/explorer/cli.ts`, `fui:tools/explorer/cliRouting.ts`, `fui:tools/explorer/routeDiscovery.ts`, `fui:tools/explorer/reportBundle.ts`, ~640 LOC) **import ~10 FUI explorer-engine internals** (`fui:tools/explorer/stateFlowGraph.ts`, `fui:tools/explorer/oracles/observation.ts`, `fui:tools/explorer/workbenchHarness.ts`, `fui:tools/explorer/routeSweep.ts`, `fui:tools/explorer/gate.ts`, `fui:tools/explorer/gateRunner.ts`, `fui:tools/explorer/docsSiteHarness.ts`, `fui:tools/explorer/authRecipe.ts`, …) that **stay in FUI** under #1565 — and **plateau-app has no `@frontierui` dependency** (verified: nothing in `plateau:package.json`). So the move would require standing up a Plateau→FUI package boundary and promoting a large swath of the explorer engine to a public `@frontierui` API — a design call, not a wire.

## Why #1577's stated unblock was a false edge

#1577 was marked "unblocked 2026-06-24: #1576 resolved (engine's WE home)". But #1576 landed the *conformance engine* contract (`ConformanceBinding` in WE #1596, runner/judge in Plateau #1597) — a **different** thing than the explorer **engine** (`stateFlowGraph` / `oracles` / `playwrightDriver` / harnesses) the CLI orchestrates. Resolving the conformance-engine home does **not** stand up the FUI-explorer-engine→Plateau import boundary the relocation needs. (The "Resolved Blocker = Maybe False Edge" rule: a cleared edge isn't proof the unblocker delivers the needed capability.)

## What you decide

Two coupled questions:

1. **The cross-repo consumption boundary.** How does the Plateau explorer *product surface* (cli/orchestration/report-bundling) consume the FUI explorer *engine* once they live in different repos?
   - **(a) `@frontierui` package dependency + a curated explorer-engine public API** — add `@frontierui` to `plateau:package.json`, export the orchestration-facing engine surface (`explore`, the oracle/observation API, harnesses, gate runner) from a stable `@frontierui/explorer` entry, and have the moved Plateau CLI import that. Cleanest long-term; biggest up-front surface-area + versioning commitment.
   - **(b) Keep the whole explorer (CLI included) in FUI as a devtool; expose only the operated/hosted wrapper in Plateau** — re-reads #1565 Fork 3 as "the *hosted product* is Plateau" without physically moving the CLI source. Smallest; may under-deliver the #1565 placement intent.
   - **(c) Duplicate the thin CLI chrome in Plateau over a narrow engine API** — move only the genuinely product-specific orchestration, behind the smallest possible engine API, accepting some chrome stays FUI.
2. **The Layer-1 `genericInvariants` home (the explicit #1565 residual).** `fui:tools/explorer/oracles/genericInvariants.ts` (app-agnostic no-crash / no-a11y) — **Plateau product-engine** vs a **shared platform-UX lib** both FUI and Plateau consume. Bias-toward-separation leans shared-lib (it is app-agnostic and not Plateau-product-specific), but that depends on whether a shared platform-UX lib home exists or must be created.

## Recommended lean (not ratified)

(1a) is the principled constellation answer (product → Plateau, engine → FUI, consumed as a versioned package) but is the largest; (1b) is the pragmatic interim if the explorer is still churning (it is — epic #1522/#1167). Sequence: decide (1) first; the genericInvariants home (2) follows the boundary it implies. Confidence low — this is a real product/architecture call for the human.

## Lineage

Surfaced during batch-2026-06-23-1725-1665 working #1577. #1577 is re-pointed `blockedBy` this — its relocation cannot land until the cross-repo boundary + genericInvariants home are settled. Grounds: #1565 Fork 3 (`we:docs/agent/platform-decisions.md#devtools-placement`), #1576/#1596/#1597 (conformance-engine home — a *different* engine), the verified-absent `@frontierui` dependency in plateau-app.
