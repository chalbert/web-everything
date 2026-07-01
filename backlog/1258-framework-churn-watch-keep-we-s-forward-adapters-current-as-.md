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

## Feature-parity goal-set — every framework feature → a WE-standard equivalent (recorded 2026-07-01)

Beyond the *wrapper/adapter* front above, the watch's deeper completeness question is: **does every
framework feature a WE consumer would reach for have a WE-standard equivalent** (an intent/block/plug/
protocol), or a deliberate dismissal? Enumerated + diffed against the registry in the 2026-07-01
goal-completeness pass — **13/13 covered** (no orphaned feature). Re-diff a newly-shipped framework feature
against this list on each run.

| Framework feature | WE-standard equivalent | Item |
|---|---|---|
| Signals / fine-grained reactivity | `reaction` intent/block, `simple-store` | #1269 |
| Resource/data loading | `loader` intent, `resource-loader` block, `prefetch` | #124, #337 |
| Actions / form-actions / mutations | `action` intent, `resource-action`, `form` | — |
| Suspense / async-region | `resource-loader` + loader; directive shape in-flight | #1976 |
| Error boundary / recovery | `reliability` intent, `error-recovery` protocol | #1019, #1978 |
| Control flow (if/for/switch) | `view` (`view:if`/`view:switch`), `for-each`, `customcomment` | #2011 |
| Context / DI provider | `customcontext`, `injectorroot`/`moduleinjector` plugs | #1044 |
| View transitions | render-strategy protocol + `view` VT hook | #015 |
| Islands / resumability / deferred hydration | loader timing + defer-hydration directive | #1977 |
| Transitions / deferred value | `motion`, `animation-orchestration`, `fragment-reveal` | #058 |
| SSR / streaming | `transient-component`, JSX server-render path | #544, #2030 |
| Routing / prefetch nav | `router` block, `navigation`, `prefetch` | #1897 |
| Wrapper/emitter conformance | wrapper-conformance vectors, `face` capability, adapters | #1271–#1273 |

The open directive proposals (#1976/#1977/#1978) are *declarative-shape* refinements of already-covered
concerns, not missing equivalents.

## Status — L0 / candidate

Recorded so the watch is not lost. Build the discovery mechanism after the platform-standards watch ([#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/)) proves the pattern; lighter priority than that keystone. Classified per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/); a sibling in the currency portfolio.

## Review log

- **2026-06-20 — first run (L0→L1).** Swept the major vendor frameworks (React/Vue/Angular/Svelte) + custom-elements interop. Front-B delta: frameworks are moving *toward* native custom-element consumption — React 19 passes Custom Elements Everywhere, and Form-Associated Custom Elements (`ElementInternals`) went broadly available — which *shrinks* WE's wrapper burden (a favorable shift, not just risk). Filed 3 slices: #1271 React-wrapper re-eval · #1272 ElementInternals adoption · #1273 framework-adapter matrix refresh. Reactivity convergence (Angular signals / Vue Vapor / Svelte runes) reinforces the Signals watch #1269 — not re-filed. Report: `we:reports/2026-06-20-program-framework-churn-watch.md`. **Next run:** re-sweep deltas since 2026-06-20.
- **2026-07-01 — second run (front-A goal-completeness pass).** Ran the new completeness pass at the *feature* level (Run 1 scoped front-A to wrapper conformance only). **Finding: the feature goal-set was never enumerated.** Reconstructed the reactivity/rendering feature axes and diffed against the intent/block/plug registry — **13/13 features covered**, 0 standard-equivalent residuals (honest-0 case). Folded the feature→WE-standard matrix into the body (new `## Feature-parity goal-set` section) so front-A stays auditable. **0 cards filed.** Front B not re-run this round. Report appended to the same living report `we:reports/2026-06-20-program-framework-churn-watch.md` (Run 2). **Next run:** re-run the front-B vendor sweep (incl. the deferred Qwik/Solid-2.0 deep-dive) and re-diff any newly-shipped feature against the 13-feature matrix.
