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

### Front-B scope — also watches the MaaS serve-contract `form` catalog (folded in from #978)

The same framework-emergence signal governs the MaaS wrapper-serve contract. Under the #974 **A1** ruling
([constellation-placement](docs/agent/platform-decisions.md#constellation-placement)), a new framework/wrapper rides
the catalog-gated `form` param (`react-wrapper`/`vue-wrapper`/…, registered in FUI's catalog #977) rather than a new
neutral contract surface — so framework churn is *supposed* to land here as a catalog entry, not a `servePathIR`
grammar change. This watch therefore owns two MaaS-serve duties:

- **Catalog currency** — when a framework gains traction, file a `form`-catalog item (e.g. `svelte-wrapper`) just as it
  files an adapter target. (This is the same motion as #1271 React-wrapper re-eval.)
- **A2-revival trip** — when a case shows the catalog **cannot absorb** a variation cleanly (the `form × framework`
  matrix strains, or an opaque `form` value is insufficient for a forward-adapter route per #507) → file a fresh
  `kind: decision` to re-run the #974 A1-vs-A2 fork with that evidence (promote a first-class neutral `framework` param
  via a versioned `servePathIR` bump). Cross-refs: provisional ruling #974, FUI catalog #977, serve-path preset idea
  #979. (Folded in from the retired #978 standing log.)

## Status — L0 / candidate

Recorded so the watch is not lost. Build the discovery mechanism after the platform-standards watch ([#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/)) proves the pattern; lighter priority than that keystone. Classified per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/); a sibling in the currency portfolio.

## Review log

- **2026-06-20 — first run (L0→L1).** Swept the major vendor frameworks (React/Vue/Angular/Svelte) + custom-elements interop. Front-B delta: frameworks are moving *toward* native custom-element consumption — React 19 passes Custom Elements Everywhere, and Form-Associated Custom Elements (`ElementInternals`) went broadly available — which *shrinks* WE's wrapper burden (a favorable shift, not just risk). Filed 3 slices: #1271 React-wrapper re-eval · #1272 ElementInternals adoption · #1273 framework-adapter matrix refresh. Reactivity convergence (Angular signals / Vue Vapor / Svelte runes) reinforces the Signals watch #1269 — not re-filed. Report: `we:reports/2026-06-20-program-framework-churn-watch.md`. **Next run:** re-sweep deltas since 2026-06-20.
