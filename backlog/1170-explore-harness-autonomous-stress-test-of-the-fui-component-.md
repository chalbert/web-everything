---
kind: story
size: 3
parent: "1167"
locus: frontierui
status: resolved
blockedBy: ["1168", "1169"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/workbenchHarness.ts"
tags: []
---

# Explore harness — autonomous stress-test of the FUI component catalog

Consumer 1 (the primary use) of the autonomous UI tester (epic #1167, locus frontierui). Drive each component in the FUI catalog in isolation in EXPLORE mode (seeded-broad, large step budget, non-gating) over the engine (#1168) + Layer-1 oracle bus (#1169), hunting for crashes and bad states. Each invariant violation becomes a backlog finding. This is the first real driver harness; tune the state-abstraction granularity empirically here.

## Resolved (batch-2026-06-19) — explore+audit runner + workbench harness, live-smoked on `:3001`

The first real driver harness — composes the #1168 engine with the #1169 oracle bus and runs it against a FUI component rendered in isolation (the #809 block-explorer workbench):

- **`fui:tools/explorer/explorer.ts`** — extended with an additive `onState` observer hook on `ExploreOptions` (fired once per newly-discovered state, while the page is AT it — the seam the oracle layer bolts onto). The pure walk + its fake-driver tests are unchanged (hook optional); the 10 #1168 tests still pass.
- **`fui:tools/explorer/exploreAndAudit.ts`** — the composition runner: walks AND audits in one pass via the hook + an injected `StateObserver`, returning `{ graph, findings }`. Pure orchestration (browser behind the driver+observer) → unit-testable with fakes.
- **`fui:tools/explorer/workbenchHarness.ts`** — Consumer 1: `stressTestComponent(page, seedUrl, opts)` in the EXPLORE profile (`maxStates 40`/`maxDepth 12`, non-gating) over a Playwright page the CALLER owns (so it runs on the already-running dev server, never spinning/killing one). The deterministic GATE profile is #1172.

Tests: `fui:tools/explorer/__tests__/exploreAndAudit.test.ts` (3 — audits every state, one observe per unique state incl. seed, clean→no findings) + `fui:tools/explorer/__tests__/workbench.smoke.spec.ts` (a BOUNDED live Playwright smoke against the real workbench on `:3001` — reused, not spun — that walks states, audits, and returns a well-formed graph + findings; **passed in 10.5s**). Full explorer unit suite green (22); `tsc --noEmit` clean; FUI `check:standards` green.

The empirical state-abstraction tuning + filing real catalog findings is the harness's ongoing USE (the workbench currently registers one block, `auto-complete` — the catalog is additive), not gated on this slice; the runnable harness + bounded smoke is the deliverable.
