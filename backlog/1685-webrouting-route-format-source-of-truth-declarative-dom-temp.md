---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, route-format, constellation-placement]
---

# webrouting route-format source-of-truth — declarative-DOM templates vs a serializable route-map vs both

Decide the canonical form of a webrouting route table: the declarative-DOM templates the router reads today, a serializable route-map the router and tooling both consume, or both with one derived from the other. Foundational — sitemap derivation, the URL-as-state seam, and any non-DOM consumer (build-time prerender, config tooling) all read whatever form is canonical.

## What you have to decide

Which form is the **single source of truth** for an app's route table, given that more than one consumer needs to read it: the runtime router, a sitemap deriver, build-time prerender, and config tooling.

## Candidate forms (to be researched + given a default by `/prepare`)

- **Declarative-DOM templates** — what ships today: `<we-route-view>` reads `<template route="/users/:id">` children (`we:src/_data/blocks/router.json`, `fui:blocks/router`). HTML-first, aligns with the WE authoring-SoT rule. But it's only readable by instantiating the DOM — a build-time sitemap or config tool can't trivially parse it.
- **Serializable route-map** — a presentation-free route-table schema (in `we:src/_data/semantics.json` + vectors) the router *and* every other consumer read. Tooling-friendly; the cost is a second authoring form competing with the templates.
- **Both, one derived** — pick one authoring form and *derive* the other (templates → extracted map, or map → stamped templates), so there is one SoT and one generated artifact.

## Grounding to gather (`/prepare`)

Prior art on file-based vs config-object vs declarative route declaration (TanStack Router, Remix, Next app-router, SvelteKit, Angular, Vue Router); whether URLPattern parsing is enough on its own; how the existing `we:src/_data/blocks/router.json` template-parsing maps to a serializable shape. Respect the WE authoring-SoT rule (author in the standard's own form, not a lowering engine).

**Next step:** `/prepare 1685` — survey, publish a `/research/` topic, state options + a bold default + confidence, set `preparedDate`.
