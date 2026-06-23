---
kind: epic
status: open
dateOpened: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, url-state, sitemap, standard, build]
---

# Scaffold the webrouting standard — route-format profile, URL-as-state contract, technical config, sitemap

Stand up a new webrouting standard project that owns the routing domain: a declarable route-format contract, the URL-as-state seam many stateful components share, technical routing configuration, and sitemap derivation — homing what is today scattered across webintents (navigation UX), webblocks (the router module), webguards (route guards) and FUI (runtime).

## Why this exists — routing has no domain owner

Routing is **partly built but ownerless**. Three pieces exist at three layers, with no project tying them together:

- **UX** — the [Navigation Intent](/intents/navigation/) (`we:src/_data/intents/navigation.json`, draft) owns the user-perceivable axes (`structure / history / scroll / transition / guard / persistence`). It *deliberately excludes* technical config and route format — correctly UX-only.
- **The module** — the `router` block (`we:src/_data/blocks/router.json`, `implementedBy: @frontierui/blocks/router`) is the imperative runtime: `<we-route-view>` reading `<template route="/users/:id">` children, committed to URLPattern (Baseline 2025) + the Navigation API. It sets no `relatedProject` — it floats in the generic `webblocks` catalog.
- **Guards** — `webguards` (`we:src/_data/projects/webguards.json`) treats route guards as one instance of its predicate seam, but does not own routing.

**Nothing owns** route *format* as a declarable contract, URL/param parsing as a contract, technical routing configuration, or sitemap derivation. The user ruling (2026-06-23): the domain has too many legitimate ways-to-do-it and too much interaction with stateful components to keep scattered — it earns its own standard project, mirroring how `webgraph` was stood up under [#1351](/backlog/1351-scaffold-the-webgraph-standard-project-graphspec-profile-lay/). Contract → WE, runtime stays in FUI, UX stays in the Navigation Intent.

## Center of gravity — the URL as a shared state store

The load-bearing surface is not route format alone but **the URL as a state store many stateful components read and write**: a data-grid's filters / sort / page, a tab selection, a wizard step, a disclosure's open-state. The hard constraint (user, 2026-06-23): **nothing is forced**. Whether any given state slice lives in the URL is a *per-slice dimension* with a permissive default — reusing the Navigation Intent's existing `persistence` vocabulary (`url | session | memory`) generalized from whole-view navigation down to each slice. The standard ships the mechanism and the vocabulary; it mandates no convention (`we:docs/agent/platform-decisions.md` — conventions fold into compliance).

## Shape forks — decide before scaffolding (research-first)

Per the `webgraph` precedent, the project is **not** scaffolded until its shape is settled. Each fork below is an **unprepared** decision child — the early step is `/prepare` (prior-art survey → published `/research/` topic → forks at DoR), then ratify. No build slice is carved until the blocking fork resolves.

- **[#1685](/backlog/1685-webrouting-route-format-source-of-truth-declarative-dom-temp/)** — route-format source-of-truth (declarative-DOM templates vs serializable route-map vs both). *Foundational; the others read whatever is canonical.*
- **[#1686](/backlog/1686-webrouting-url-as-state-seam-one-shared-serialize-sync-provi/)** — the URL-as-state seam shape (shared provider vs per-component declaration). *The heart; carries the never-force / per-slice-persistence constraint.*
- **[#1687](/backlog/1687-webrouting-technical-config-home-schema-in-webrouting-vs-a-p/)** — technical-config home (schema in webrouting vs a plateau Configurator domain).
- **[#1688](/backlog/1688-webrouting-sitemap-derivation-scope-which-artifact-set-ships/)** — sitemap derivation scope (which artifact set ships in v1).

## Planned deliverables (carved via `/slice 1684` once the forks ratify, mirrors #1351)

- **Project node + skeleton spec page** — `we:src/_data/projects/webrouting.json` + `we:src/_includes/project-webrouting.njk`; the `router` block gains `relatedProject: webrouting` + `implementsIntent` stays `navigation`.
- **Route-format semantic profile + conformance vectors** — route-table schema in `we:src/_data/semantics.json` and WE-owned vectors, presentation-free, in the canonical form #1685 settles.
- **URL-as-state contract** — the serialize/restore seam + per-slice `persistence` declaration #1686 settles, grounded on the Navigation Intent `persistence` axis.
- **Sitemap deriver** — the v1 emitter set #1688 picks, derived from the route table.
- **Research grounding** — `/research/` topics produced by `/prepare` on each fork; add routing prior art (TanStack Router, Remix, Next, SvelteKit, Vue Router, nuqs) to `we:src/_data/references.json`.

## Downstream

Lands the domain owner the `router` block declares against, and the contract the [#1245](/backlog/1245-reference-runtime-blocks-router-navigation-are-duplicated-an/) router-dedup epic's conformance vectors can target. Adapters and a flagship demo are deferred and carved after the contract lands, per the webcharts/webgraph precedent.

## Definition of Done

All four forks (#1685–#1688) ratified and codified; the `webrouting` project node + spec page published; route-format profile + conformance vectors landed; the URL-as-state contract and v1 sitemap deriver specced. Resolves with `graduatedTo: webrouting`.
