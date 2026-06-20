---
type: idea
workItem: epic
status: resolved
locus: frontierui
dateOpened: "2026-06-19"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/index.ts"
tags: [fui-devtool, exploratory-testing, conformance, autonomous-agent, a11y, close-out-gate, dogfood, epic]
relatedReport: reports/2026-06-19-autonomous-exploratory-ui-testing.md
---

# Autonomous exploratory UI testing tool — an FUI-owned engine that drives a live UI on its own, finds bugs, and gates UI work

## Resolved (batch-2026-06-19) — all carved slices shipped; Layer-2/3 is a deliberate deferral on #899

Every carved slice landed in `fui:tools/explorer/` (batch-2026-06-19): **#1168** engine core (Crawljax state-flow walk + Playwright driver), **#1169** Layer-1 generic-invariants oracle bus, **#1170** Consumer 1 (component stress-test), **#1171** Consumer 2 (docs-site sweep, doubles as the #777 rendered-works proof), **#1172** Consumer 3 (deterministic pre-close gate). One engine, three consumers, all live-smoked against the running dev servers. The **Layer-2 conformance-vector oracle + Layer-3 advisory LLM-judge** below are an explicit, deliberate **deferral blocked on #899** (the behavioral-conformance vectors must exist first) — NOT an unsliced gap; carve them once #899 lands. The "(Later, not yet carved)" / "Build order" language below is the original plan, retained for lineage.

An agent that drives a live web UI **on its own** — clicks, types, navigates — discovers reachable states, and flags bugs/regressions/odd behaviors **without a pre-written script** (autonomous exploratory / monkey / model-based testing, LLM-steerable). Three first consumers ride **one engine**, in priority order: **(1)** stress-test FUI components in isolation (the primary use); **(2)** verify the WE docs website works-as-supposed (same engine, components-in-assembly — doubles as the dogfood [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/) rendered-works proof); **(3)** an agent-invoked pre-close gate on UI work items. Grounded in [we:reports/2026-06-19-autonomous-exploratory-ui-testing.md](../reports/2026-06-19-autonomous-exploratory-ui-testing.md).

## Placement — FUI-owned devtool, not a WE standard (~85%)

An **implementation capability, not a contract** — so by the constellation's standing rules it is **not** a `@webeverything` standard. It lands in FUI (`locus: frontierui`), the same family as the block-explorer workbench ([#809](/backlog/809-block-explorer-workbench-render-locus-manipulation-channel-f/), a FUI-owned product) and the generator-is-a-tool ruling ([#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/), FUI owns zero-lock-in devtools). FUI owns its components, so the thing that stress-tests them lives with them. The one WE-facing seam is the **oracle**: for *semantic* correctness the tester checks a component against WE's behavioral-conformance vectors ([#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/)) — that *contract* crosses the seam; the engine never does. A generic web-UI tester sold as a Plateau product is a downstream call, out of scope here.

## Two settled design defaults (recorded, not contested forks)

Both surfaced in the brainstorm with a clear default the prior-art survey confirms, so they are baked into the build, not carved as `type:decision` forks (the fork-existence test fails — no branch is *broken*, the alternatives are just weaker).

- **A. Oracle layering — generic invariants first (~85%).** How does an autonomous tester know something is *wrong* with no script? Layer cheapest-first: **(1)** generic invariants always-on (no console errors / unhandled promise rejections / HTTP 5xx / axe-core a11y violations / broken layout / dead-end-stuck-focus / crash — works on a bare component *and* a whole page, **reusing the #770 axe lane**); **(2)** conformance/expectations (the #899 vectors for components, a small site-expectation set for the website); **(3)** an LLM-as-judge layer that stays **advisory only** (WebVoyager pattern — probabilistic, candidate findings, never a hard gate verdict).
- **B. Two invocation profiles — explore vs. gate (~85%).** Exploratory testing is non-deterministic, but a close gate must be bounded and reliable. The same engine runs in two profiles: **explore** (seeded-broad, large budget, on-demand/nightly, findings → backlog items, never blocks) and **gate** (fixed seed, hard step/time budget, fails only on hard Layer-1 invariants, deterministic, blocking — records seed+trace on failure). Same shape as the deterministic-conformance-gate ruling (#463).

## Prior art (web survey, grounds the report)

Crawljax state-flow graph (state = DOM signature, edge = event) = the explorer core and the app-agnostic invariant-oracle approach; Android Monkey = the seeded crash-only baseline; WebVoyager/Agent-E + commercial tools (Mabl, Octomind, QA Wolf, Momentic) ground the LLM-judge layer **and** confirm every commercial tool still needs human-approved assertions for precise correctness (judge stays advisory); fast-check + Meticulous ground the explore-vs-gate split exactly; **Playwright + axe-core** (`@axe-core/playwright`) are the de-facto substrate.

## Dependencies & related work

- **[#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/)** (epic) — the dogfood site; Consumer 2's website sweep is the rendered-works proof this epic wants.
- **[#770](/backlog/770-rendered-site-a11y-gate-axe-lane-route-allowlist-we-docs/)** — the rendered-site a11y axe lane; the Layer-1 a11y oracle **reuses** it (not a second axe integration).
- **[#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/)** — behavioral-conformance vectors; the Layer-2 conformance oracle consumes them. **Hard gate** for the Layer-2/3 slice only.
- **[#809](/backlog/809-block-explorer-workbench-render-locus-manipulation-channel-f/)** / **[#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/)** — FUI-owned-devtool precedents that place this in FUI.

## Slicing

Sliced umbrella (size-less; children carry the points). Build order:

- **#1168 — Explorer engine core.** Playwright driver + Crawljax-style state-flow graph (state = DOM signature, edge = fired event) + coverage tracking + state dedup. The substrate. Ready.
- **#1169 — Layer-1 generic-invariants oracle bus.** Always-on probes (console / promise / 5xx / axe-core / layout / dead-end), reusing the #770 axe lane. Blocked on #1168.
- **#1170 — Explore harness: FUI component-catalog stress-test** (Consumer 1). Blocked on #1168 + #1169.
- **#1171 — Explore harness: WE docs website sweep** (Consumer 2, ties #777). Blocked on #1168 + #1169.
- **#1172 — Gate mode + agent-invoked pre-close gate on UI items** (Consumer 3). Blocked on #1168 + #1169.
- **(Later, not yet carved)** Layer-2 conformance-vector oracle + Layer-3 advisory LLM-judge — **blocked on #899** (vectors must exist). Tracked here as a deferral; carve once #899 lands.

## Tuning & deferral notes (not forks; settle in-build as slices proceed)

- **State-abstraction granularity** — the Crawljax "when are two DOMs the same state?" knob. Tune empirically on the FUI catalog in slice #1170; start with a normalized-DOM signature.
- **Visual-diff as a Layer-2 oracle** — needs a baseline store + human approve/reject (Applitools-style); lower confidence, deferred until Layer 1 proves out.
- **Generic-product generalization** — a sellable generic web-UI tester on Plateau is downstream and out of scope for this epic.
