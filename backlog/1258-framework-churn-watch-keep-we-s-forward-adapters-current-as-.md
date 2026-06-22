---
kind: epic
ongoing: true
relatedReport: reports/2026-06-20-program-framework-churn-watch.md
status: open
dateOpened: "2026-06-20"
tags: []
---

# Framework-churn watch

Candidate front-B watch program: track API churn across the major vendor frameworks (React/Vue/Svelte/Solid) so WE's forward/generation adapters ([forward-generation-adapters](docs/agent/platform-decisions.md#forward-generation-adapters), #463) do not silently rot, and new adapter targets get discovered. Front A: adapters still generate conformant output against current framework APIs. Front B: a framework ships a breaking API change or a new framework gains traction → file adapter-maintenance or new-target items. L0/candidate — filed now to record the watch; build the discovery mechanism once the platform-standards watch proves the pattern. Lighter priority than the platform-standards keystone.

## The two fronts

- **Front A:** WE's forward/generation adapters (#463) still emit conformant output against current framework APIs.
- **Front B:** a vendor framework (React/Vue/Svelte/Solid) ships a breaking API change, or a new framework gains traction → file adapter-maintenance or new-target items.

## Status — L0 / candidate

Recorded so the watch is not lost. Build the discovery mechanism after the platform-standards watch ([#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/)) proves the pattern; lighter priority than that keystone. Classified per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/); a sibling in the currency portfolio.

## Review log

- **2026-06-20 — first run (L0→L1).** Swept the major vendor frameworks (React/Vue/Angular/Svelte) + custom-elements interop. Front-B delta: frameworks are moving *toward* native custom-element consumption — React 19 passes Custom Elements Everywhere, and Form-Associated Custom Elements (`ElementInternals`) went broadly available — which *shrinks* WE's wrapper burden (a favorable shift, not just risk). Filed 3 slices: #1271 React-wrapper re-eval · #1272 ElementInternals adoption · #1273 framework-adapter matrix refresh. Reactivity convergence (Angular signals / Vue Vapor / Svelte runes) reinforces the Signals watch #1269 — not re-filed. Report: `we:reports/2026-06-20-program-framework-churn-watch.md`. **Next run:** re-sweep deltas since 2026-06-20.
