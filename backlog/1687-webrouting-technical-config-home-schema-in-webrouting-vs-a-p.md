---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, technical-config, configurator, constellation-placement]
---

# webrouting technical-config home — schema in webrouting vs a plateau Configurator domain

Decide where the technical routing knobs the Navigation Intent deliberately punts — base path, history mode, lazy/code-split, prerender, scroll policy — are declared. Either a config schema owned by webrouting in WE, or a Technical Configurator domain in plateau-app that helps a dev choose values. Not exclusive; the fork is which is the source-of-truth contract and which (if any) is downstream tooling.

## What you have to decide

Where the **technical routing configuration** — the knobs the Navigation Intent intentionally excludes as non-UX (base path, history mode, lazy/code-split policy, prerender, scroll-restoration policy, 404 fallback) — is declared as a contract, and whether a Configurator domain assists choosing values.

## Why this is a real fork

The platform rule is **intents are UX-only; technical strategies go to a Configurator** (`we:docs/agent/platform-decisions.md`, intent-UX-only). So these knobs cannot live in the Navigation Intent. They belong either in a webrouting config *schema* (the declarable contract) or a plateau-app Technical Configurator *domain* (the data-driven decision tool) — or both, with one as the SoT.

## Candidate homes (to be researched + given a default by `/prepare`)

- **Config schema in webrouting (WE)** — a presentation-free route-config schema alongside the route-format profile; the contract every consumer reads. The Configurator, if any, is downstream tooling over it.
- **Technical Configurator domain in plateau-app** — add a routing domain to the existing data-driven Configurator (`plateau:` technical-configurator) that walks a dev through the choices and emits config. SoT is the seed/provider, WE holds only the vocabulary.
- **Both** — schema is the SoT contract in WE; a plateau Configurator domain is downstream and optional.

## Grounding to gather (`/prepare`)

Which knobs are genuinely technical-config vs already covered by the Navigation Intent or the route-format profile (#1685); how `webgraph`/other standards split a WE schema from a plateau Configurator domain; the existing Configurator domain-add shape (seed + provider entry).

**Next step:** `/prepare 1687` — survey, publish a `/research/` topic, state options + a bold default + confidence, set `preparedDate`.
