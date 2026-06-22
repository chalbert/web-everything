---
kind: story
size: 5
status: open
blockedBy: ["1576"]
dateOpened: "2026-06-22"
tags: []
---

# Relocate the explorer CLI chrome / orchestration / report-bundling FUI → Plateau

Per #1565 Fork 3 (we:docs/agent/platform-decisions.md#devtools-placement): move the explorer's operated product surface — fui:tools/explorer/cli.ts, fui:tools/explorer/cliRouting.ts, fui:tools/explorer/routeDiscovery.ts, fui:tools/explorer/reportBundle.ts (the 'point it at any URL' orchestration + report-bundling) — to plateau-app. It consumes the WE conformance engine (#1576) + the target implementer's binding + Plateau vision (Layer-3, #475) as services. Also decide here the home of Layer-1 fui:tools/explorer/oracles/genericInvariants.ts (app-agnostic no-crash/no-a11y) — the #1565 residual: Plateau product-engine vs a shared platform-UX lib. Blocked on #1576 (engine's WE home).
