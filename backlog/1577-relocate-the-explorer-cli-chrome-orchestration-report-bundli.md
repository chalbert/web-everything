---
kind: story
size: 5
status: open
blockedBy: ["1747"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-24"
tags: []
---

# Relocate the explorer CLI chrome / orchestration / report-bundling FUI → Plateau

Per #1565 Fork 3 (we:docs/agent/platform-decisions.md#devtools-placement): move the explorer's operated product surface — fui:tools/explorer/cli.ts, fui:tools/explorer/cliRouting.ts, fui:tools/explorer/routeDiscovery.ts, fui:tools/explorer/reportBundle.ts (the 'point it at any URL' orchestration + report-bundling) — to plateau-app. It consumes the WE conformance engine (#1576) + the target implementer's binding + Plateau vision (Layer-3, #475) as services. Also decide here the home of Layer-1 fui:tools/explorer/oracles/genericInvariants.ts (app-agnostic no-crash/no-a11y) — the #1565 residual: Plateau product-engine vs a shared platform-UX lib. Unblocked 2026-06-24: #1576 (engine's WE home) resolved — the engine's `ConformanceBinding` interface now lives in WE (#1596) and the runner/judge impl in Plateau (#1597), so this CLI-chrome move can proceed.

## Re-scope finding (batch-2026-06-23-1725-1665) — blocked-in-fact + embedded fork; `blockedBy: 1747`

Claimed and ground the move: it is **not** the mechanical FUI→Plateau file move the card implies. The four product-surface files import ~10 FUI explorer-**engine** internals (`fui:tools/explorer/stateFlowGraph.ts`, `fui:tools/explorer/oracles/observation.ts`, `fui:tools/explorer/workbenchHarness.ts`, `fui:tools/explorer/routeSweep.ts`, `fui:tools/explorer/gate.ts`, `fui:tools/explorer/gateRunner.ts`, `fui:tools/explorer/docsSiteHarness.ts`, `fui:tools/explorer/authRecipe.ts`, …) that stay in FUI under #1565 — and **plateau-app has no `@frontierui` dependency** (verified absent in `plateau:package.json`). So the move needs a Plateau→FUI package boundary + a curated explorer-engine public API stood up first (a design call), plus the explicit #1565 residual decision on the `genericInvariants` home. The stated "unblocked by #1576" was a **false edge** — #1576 landed the *conformance* engine, a different engine than the explorer engine the CLI orchestrates.

Filed the coupled decision as **#1747** and re-pointed `blockedBy: 1747`; set back to `open`. Not pure-agent buildable until that settles; `/batch` declined it as blocked-in-fact (fork) and released the claim.
