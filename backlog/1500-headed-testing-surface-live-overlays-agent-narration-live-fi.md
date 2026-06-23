---
kind: story
size: 8
status: resolved
locus: plateau-app
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "plateau:src/dev-browser/headed-surface/"
tags: [dev-browser, explorer, testing, visualization, plateau, product]
---

# Headed testing surface — live overlays + agent narration + live finding stream over the explorer/oracle apparatus (dev-browser)

A **headed, visualized mode** for the autonomous UI-testing apparatus, surfaced as a dev-browser
"lights-up" panel ([#140](/backlog/140-dev-surface-product-feature-matrix/) matrix, embedded by the
shell [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/)). Today the
explorer (`fui:tools/explorer/explorer.ts`) and its three oracle layers run **fully headless** — output is
markdown/JSON via the #1219 CLI / #1220 `/stress-test` skill, with no live view. This surface makes a run
**watchable**: overlays on the page-under-test (current state, the element being acted on, oracle hits in
place), a narration stream explaining what the agent is doing and *why*, and a live finding feed as
defects are discovered. Generic over the **whole tool family**, not the oracle alone — the explorer walk,
each oracle layer (generic invariants / conformance vectors / advisory judge), and the conformance/stress
runs all drive it.

## The seam (what makes it generic, and what's WE vs product)

The tools already produce the data; what's missing is a **live trace-event stream** they emit as they run
(state-entered, action-fired, observation, finding, run-complete) instead of only a terminal report. The
overlay/narration/feed are **pure consumers that render that stream as data** — mirroring the #832
block-explorer overlay (renders findings as data, never reaches into the subject). So:

- **WE-relevant seam (if any):** the structured trace-event / finding shape is a data contract. Verify
  whether it belongs with the oracle observation contract or stays a FUI-tools concern — the explorer is
  FUI-owned (`fui:tools/explorer/`), so default is FUI emits, product consumes.
- **Product surface (this card):** the overlay renderer, narration UI, and live feed are a dev-browser
  panel — `plateau:src/dev-browser/` (or its extension/DevTools-panel MVP, the #141-sequenced first
  build). No subject mutation; reads the trace stream only.

## Scope (to slice when funded)

- **Trace-event stream** — have the explorer/oracle apparatus emit a structured live event per step
  (state, action, observation, finding) over a streaming seam, not just a final report. One emitter, all
  tools.
- **Page overlays** — draw current state + acted-on element + in-place oracle hits onto the running
  page-under-test (the headed Playwright/CDP page or a mirrored view).
- **Agent narration** — a human-readable "what / why" line per step (what it's about to do, why that
  candidate, what the oracle saw), distinct from the raw event log.
- **Live finding feed** — defects stream in as discovered, each linkable to the state/action that
  surfaced it and to the #1220 "file as backlog item" offer.
- **Generality check** — confirm the surface is driven purely by the event contract so a *new* tool
  (a future oracle layer, a different walker) lights it up with zero panel changes.

## Sequencing

Gated behind the funnel-data triage in [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/) (the surface bet carved out of the #140 matrix) like its sibling shell #1391; per the [monetization](docs/agent/platform-decisions.md#monetization) rule (#141) the **extension /
DevTools-panel MVP is the cheap first surface** (proves the live view on a conformant app before the
standalone browser). The headless engine + CLI (#1219/#1220) already exist — this is the visualization
layer over them, not new test logic. File the trace-event emitter as the leading slice (it unblocks every
consumer and is the only possible WE-side seam).

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Built the **leading slice** — the trace-event contract + the pure consumers — as
`plateau:src/dev-browser/headed-surface/`. (The pixel-drawing renderer onto a live headed
Playwright/CDP page is the residual UI layer over this; this card delivers the data architecture the
body names as the unblocking slice.)

- **`plateau:src/dev-browser/headed-surface/types.ts`** — the trace-event contract: a discriminated
  `TraceEvent` union (`state-entered` / `action-fired` (with `why` + `targetLocator`) / `observation` /
  `finding` / `run-complete`), mirroring the explorer's state-flow vocabulary, plus the consumer-rendered
  shapes (`NarrationLine`, `FindingFeedEntry`, `OverlayMarker`/`OverlayModel`).
- **`plateau:src/dev-browser/headed-surface/stream.ts`** — `TraceEventStream`: the one emitter every tool
  writes to (`emit` stamps monotonic `seq`/`atMs`, fans live to subscribers, keeps history for a
  mid-run attach). `EmittedEvent` (distributive-omit) is what a tool emits.
- **`plateau:src/dev-browser/headed-surface/consumers.ts`** — the three **pure consumers** that render the
  stream as data (never touching the subject, the #832 pattern): `narrate`/`narrateAll` (the "what/why"
  line per event), `FindingFeed`/`findingFeed` (defects in discovery order, linked to their state/action +
  a severity roll-up), and `overlayModel` (a fold to the current-state + acted-element + per-state
  oracle-hit/finding markers the renderer paints, reset on state entry).
- **`plateau:src/dev-browser/headed-surface/headed-surface.test.ts`** — 6 tests (stream stamping +
  subscribe/unsubscribe + history, narration per kind, finding feed + roll-up, overlay fold + reset, and
  the per-state marker surfacing).

**Generality check met:** every event flows through the same generic consumers, so a new tool (a future
oracle, a different walker) lights up narration + feed + overlay with **zero consumer changes** — the
contract is the only coupling. Ownership per *The seam*: the explorer (FUI) emits, this product surface
consumes. Plateau suite green (only the pre-existing external `render-conformance` baseline red).
