---
kind: story
size: 5
parent: "089"
status: resolved
locus: plateau-app
relatedProject: webregistries
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "plateau-app/src/platform-manager/platform-impact-narrator.ts (NL Q&A over the #442 graph; deterministic SoT + injected optional AI narrator)"
tags: []
---

# Platform impact narrator over the #092 relationship graph

Natural-language Q&A over the resolved #092 platform relationship graph (impact analysis, what-breaks-if). An open-core revenue-tool candidate; the AI narrates, the graph is the verified source of truth. Buildable now — #092 graph resolved.

## Locus correction (batch-2026-06-17) — plateau-app, not WE

Filed without a `locus`, so it defaulted to WE — but #092 Fork 3 split this surface to **plateau-app** (the licensed product half: graph aggregation + impact + governance + UI). The graph it narrates over is the resolved plateau-app platform-manager (`plateau:aggregator.ts` #442 + `plateau:impact-analysis.ts` #443), and "open-core revenue-tool" is by definition a Plateau product surface. Set `locus: plateau-app`; built + gated there.

## Progress

- **Resolved 2026-06-17.** Built `plateau:plateau-app/src/platform-manager/platform-impact-narrator.ts` — NL Q&A
  over the cross-repo provider–consumer graph: `answerQuestion("what breaks if I change X?", { aggregator,
  graph, narrate? })` parses the question (`parseQuestion`), computes the answer from the graph via the
  resolved `analyzeImpact` (#443), and narrates it. Intents: impact / dependents / dependencies / describe;
  entity resolved by longest id/label match.
- **Honours the platform rules (no buried fork — the rulings determined the shape):** the **graph is the
  verified SoT** — the deterministic engine computes every answer (owned, fixed-cost, on-device; the
  linear-cost-with-revenue rule), and the structured `ImpactReport` is always what's returned. The AI is
  an **injected, optional** layer (`ImpactNarrator`, #475 no-leakage — no SDK imported): present → it
  enriches the prose; absent or failing → the deterministic narration stands; never invoked on an
  ungrounded miss (no spend on a miss). So the tool is correct and useful at **zero AI spend** — the AI
  is the paid tier, not the floor.
- **Tested + gated:** 11-case offline suite (`plateau:platform-impact-narrator.test.ts`) over the seed model —
  every intent, the AI-used / AI-throws-fallback / AI-empty-fallback / never-invoked-on-miss paths, and
  graceful no-entity degrade. Full plateau-app gate green (`npm test`: 26 files, 206 tests).
