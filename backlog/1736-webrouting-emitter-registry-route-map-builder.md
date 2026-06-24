---
kind: story
size: 3
parent: "1684"
status: resolved
blockedBy: []
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
relatedReport: reports/2026-06-24-backlog-split-analysis.md
tags: []
---

# webrouting emitter registry + route-map builder

we:webrouting — the foundational emitter slice graduated from #1688. Build the default-less pluggable emitter REGISTRY (an open set the project config extends; new emitters join without a decision) plus the DOM→map BUILDER that #1721 parked for the first consuming slice: run parseRouteDefinitions() (we:blocks/router/types.ts:194) over RouteDefinition[], drop the non-serializable pattern + template, emit the serializable routes[].path map every emitter reads. Ships derivation + foundational conformance vectors (WE holds the contract; browser-runtime impl rides downstream to FUI). Blocked by the projection schema (#1721) + project skeleton (#1725). Codified in #faithful-derivation-exclude-not-fabricate.

## Progress (batch-2026-06-23-1725-1665) — DONE

Built the route-map builder #1721 parked + the default-less pluggable emitter registry (the #1688 foundational emitter slice):
- `we:blocks/router/route-map.ts` — added `buildRouteMap(definitions, base?)`: the **faithful DOM→map derivation** (`#faithful-derivation-exclude-not-fabricate`). Projects a parsed `RouteDefinition[]` (the serializable subset; `pattern`/`template` dropped, never read) into the #1721 `RouteMap`, in source order, normalizing `isErrorBoundary` to true-only and **never fabricating** a missing optional. Pure data — needs no DOM (the DOM-walking parse that produces the definitions is the FUI browser-runtime impl); WE owns this contract every emitter reads.
- `we:blocks/router/route-emitters.ts` — the `RouteMapEmitter` contract + `RouteEmitterRegistry`: a **default-less open set** (register/has/get/ids/emit/emitAll). Support-all behind a pluggable registry — each emitter is a facade over the one kernel and cannot conflict, so new emitters join without a decision (config-extends-platform-default); an empty registry is valid (emits nothing), no first-registered default.
- `we:blocks/router/__fixtures__/route-builder-cases.ts` — 5 foundational conformance vectors (order preserved, optionals not fabricated, error-boundary normalized, base recorded, empty). `we:blocks/__tests__/unit/route-map-builder.test.ts` — 10 tests (every built map round-trips the #1721 validator + equals its golden; the registry fan-out + unknown-id throw + empty-valid). Exported from `we:blocks/router/index.ts`.

WE holds the contract + vectors; the browser/build runtime that drives the emitters rides downstream to FUI. Cleared the stale `blockedBy: 1721, 1725`. Gate 0 errors.
