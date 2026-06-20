---
type: idea
workItem: story
size: 5
parent: "1167"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/index.ts"
tags: []
---

# Explorer engine core — Playwright driver + Crawljax-style state-flow graph for the autonomous UI tester

The substrate for the autonomous exploratory UI tester (epic #1167, locus frontierui). Build a Playwright-driven explorer that fires events on candidate interactive elements, detects DOM-state changes, and infers a state-flow graph (state = normalized DOM signature, edge = fired event) with coverage tracking and state dedup — the Crawljax model over a Playwright driver. No oracles yet (those are #1169); this slice just walks and maps reachable states deterministically from a seed.

## Resolved (batch-2026-06-19) — driver-agnostic core + Playwright adapter at `fui:tools/explorer/`

Built the explorer substrate in FUI (the same `tools/` family as the workbench/gen-wrapper devtools). Architected as a **pure, browser-agnostic core over an injected `ExplorerDriver`** so the walk is deterministically unit-testable WITHOUT spinning the live `:3001` server (the dev-server-untouched rule held — this slice is code + headless unit tests, no browser launched):

- **`fui:tools/explorer/domSignature.ts`** — the Crawljax state-abstraction. A `DomNodeSnapshot` → a stable FNV-1a hash of the normalized structural tree: tag + ARIA roles + the significant *interactive-state* attributes (`aria-expanded`/`open`/`disabled`/`checked`/`selected`/`hidden`/`data-state`…), deliberately IGNORING volatile content (text/ids/timestamps). Two DOMs that differ only in volatile bits hash equal; a menu opening or a tab switching hashes differently. Deterministic (no `Date`/`Math.random`).
- **`fui:tools/explorer/stateFlowGraph.ts`** — the directed multigraph: states deduped by signature, edges = fired transitions, plus a per-state coverage ledger (candidates seen vs fired) → a `CoverageReport`.
- **`fui:tools/explorer/explorer.ts`** — the deterministic, bounded BFS walk. Fixed candidate order, no randomness, Crawljax reset-and-replay to re-reach a state (a fire mutates the page; there's no general "back"), hard `maxStates`/`maxDepth` budget (the gate-profile bounded-stop guarantee, epic #1167 default B / #463).
- **`fui:tools/explorer/playwrightDriver.ts`** — the thin Playwright adapter: `goto` seed, in-page `page.evaluate` structural snapshot + interactive-candidate extraction (deterministic `nth-of-type` CSS-path refs, stable across replay), click-to-fire. Carries no tests of its own (the engine is covered against a fake driver; a real-page spec rides the gate slice, #1167 Consumer 1).

Tests: `fui:tools/explorer/__tests__/explorer.test.ts` (10 — signature stability/sensitivity/order-invariance, graph dedup+coverage, and the walk against a fake in-memory UI state machine: discovers every reachable state, dedups cycles back to a known state, full coverage on a finite fixture, deterministic across two runs, respects `maxStates` + `maxDepth`). `tsc --noEmit` clean for all five modules; FUI `check:standards` green (0 errors).
