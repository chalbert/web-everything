---
type: decision
workItem: story
size: 2
parent: "070"
status: resolved
blockedBy: ["070"]
dateOpened: "2026-06-06"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
preparedDate: "2026-06-11"
tags: [jsx, adapters, directives, resource, async, loader, intent]
relatedReport: reports/2026-06-11-resource-directive-async-contract.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Specify the `<Resource>` directive's async contract

**Digest.** Grounded in the real tree (the `Resource` registry entry, the lowering compiler's
missing `resource` rule, the Loader Intent state machine, the Resource Loader block) and a
prior-art survey of async-resource primitives (SolidJS `createResource`/`<Suspense>`/
`<ErrorBoundary>`, React 19 `use()`/`useTransition`, TanStack Query/Router) published as the
[Resource Directive Async Contract](/research/resource-directive-async-contract/) research topic.
The four axes resolve to: **Fork 1 — named loading/error/success slots that *are* Loader
lifecycle states**; **Fork 2 — resolve *through* the Loader Intent, no new state machine**;
**Fork 3 — lower/lift to a `use()`-style suspending read with Suspense/ErrorBoundary
boundaries**; **Fork 4 — pagination is a Loader `loadingMore` + Windowed Collection
composition, deferred to #018**. Net: `<Resource>` becomes a declarative composition of the
Loader Intent — no new intent, no parallel async model. Stays `open` pending ratification.

The directive-sugar layer (#070) shipped `<For>`/`<Show>`/`<Resource>` through **one registry**
([directives.ts:54](../blocks/renderers/jsx/directives.ts#L54)) as reversible spellings of
`<template is="for-each|if|resource">`. But unlike `for-each` and `if` — which map to **real,
existing** directives the lowering compiler (#078) already round-trips
([crossStrategy.ts:88,107,153,167](../blocks/renderers/jsx/render-strategy/crossStrategy.ts#L88))
— **`is="resource"` is net-new and appears in NONE of those rules**. `Resource`
([directives.ts:57](../blocks/renderers/jsx/directives.ts#L57), `from` prop) is currently pure
spelling: `makeDirective` ([directives.ts:173](../blocks/renderers/jsx/directives.ts#L173))
builds the inert `<template is="resource" from="…">` DOM the canonical form builds, and nothing
more — nothing says what a resource *resolves to*, what surfaces it owns, or what it lowers to.

The platform already owns the missing pieces; they are simply unwired. The **Loader Intent**
([intents.json:439](../src/_data/intents.json#L439)) is a full async state machine —
`idle | pending | success | error | stale | filtering | loadingMore`, with `escalation`,
version-token stale-resolve prevention, and hierarchy aggregation — and it explicitly names a
`loadingMore` state that "composes the Windowed Collection Intent" and a `stale` state for
"showing previous data while a refresh is in progress." The **Resource Loader** block
([blocks.json:203](../src/_data/blocks.json#L203), `implementsIntent: "loader"`) already
implements that machine. So this is a **wiring decision**, not an invention. The
`from="@…"` injector ref resolves through Loader; the directive contributes a declarative
trigger + slot surface.

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · slots / states** | named `loading`/`error` slots = Loader lifecycle states | one merged `fallback` slot *(rejected)* | **High** — Suspense/ErrorBoundary split is universal |
| **2 · Loader wiring** | resolve *through* Loader Intent + Resource Loader block | own resource state machine *(rejected)* | **High** — "cross-reference, don't duplicate" + block exists |
| **3 · lowering (#078)** | `use()`-style suspending read + Suspense/ErrorBoundary | bare `await` form *(rejected)* | **Med-high** — read-suspends is the cross-library primitive |
| **4 · #018 pagination** | Loader `loadingMore` + Windowed Collection, deferred to #018 | spec pagination in the directive now *(rejected)* | **High** — Loader already has the seam |

## Fork 1 — slots / states surface

**Crux:** does `<Resource>` own a loading/error/fallback surface, and in what shape? The item
asks: child `<template is="if">`-style branches, or named slots `loading`/`error`? Refs:
SolidJS [`<Suspense>`+`<ErrorBoundary>`](https://docs.solidjs.com/guides/fetching-data),
React 19 [`<Suspense>`](https://react.dev/reference/react/Suspense)+error boundary; the Loader
Intent's lifecycle states ([intents.json:439](../src/_data/intents.json#L439)).

- **(A — recommended) Named-slot branches whose names are Loader lifecycle states.**
  `<template slot="loading">` / `<template slot="error">`, default (unslotted) children =
  resolved/success content. The slot vocabulary *is* the Loader Intent's existing states
  (`pending`/`error`/`success`), not freshly coined ones — so a `<Resource>` is literally a
  declarative composition of the Loader state machine. Mirrors the universal
  Suspense-fallback + ErrorBoundary-fallback split (two separate surfaces). Cost: defines a
  slot contract on the directive.
- **(B) One merged `fallback` slot.** Cheaper, but collapses loading and error into one
  surface — every surveyed primitive keeps them as independent nestable boundaries. Loses the
  separation. *Rejected.*
- *Rejected:* a child-`<template is="if">` branching DSL — re-invents conditional branching the
  slot model already provides, and couples the resource surface to the `if` directive.

## Fork 2 — Loader Intent wiring

**Crux:** does `from="@…"` resolve through the **Loader Intent** (pending/determinate/
escalation) and the async-collection lifecycle, or is the resource its own thing? The item's own
guidance: "cross-reference, don't duplicate." Refs: Loader Intent
([intents.json:439](../src/_data/intents.json#L439)); Resource Loader block
([blocks.json:203](../src/_data/blocks.json#L203), `implementsIntent: "loader"`).

- **(A — recommended) Resolve through the Loader Intent + Resource Loader block.** The directive
  contributes the *declarative trigger + slot surface* (Fork 1); all state transitions,
  anti-flicker (entry-threshold + hold-floor), version-token stale-drop, escalation
  (`none|warn|async`), and hierarchy aggregation are Loader's, unchanged. The resource is a
  declarative front-end to the orchestrator that already exists.
- **(B) A standalone resource state machine.** Self-contained, but duplicates Loader, drifts
  from the Resource Loader block, and fragments the platform's single async story. *Rejected.*
- *Rejected:* a thin ad-hoc loading flag with no escalation/stale/version-token — re-derives a
  subset of Loader badly.

## Fork 3 — lowering correspondence (#078)

**Crux:** what vdom-strategy form does `is="resource"` lift to, so `crossStrategy` can carry it?
The compiler lowers `for-each`→`.map()` and `if`→`&&`
([crossStrategy.ts:88,107](../blocks/renderers/jsx/render-strategy/crossStrategy.ts#L88)) but has
**no resource rule**. Refs: React [`use()`](https://react.dev/blog/2024/12/05/react-19), SolidJS
[`createResource`](https://docs.solidjs.com/reference/basic-reactivity/create-resource) — the
read suspends; the lossy-diagnostic mechanism at
[crossStrategy.ts:124](../blocks/renderers/jsx/render-strategy/crossStrategy.ts#L124).

- **(A — recommended) Suspending-read form + boundary slots.** `is="resource" from="E"` lifts to
  a `use()`-style suspending read (`const data = use(E)` — the cross-library primitive), with the
  `slot="loading"` / `slot="error"` branches lifting to enclosing `<Suspense>` /
  `<ErrorBoundary>` boundaries. `lift`/`lower` gain a `resource` correspondence. Because the read
  has suspense semantics with no inert HTML inverse, the lower path raises a
  `resource-suspends-on-read` diagnostic (`lossy`) exactly as the eager/reactive interpolation
  boundary does today.
- **(B) A bare `await` form.** Simpler-looking, but provides no correspondence for the
  loading/error slots and doesn't model suspension/boundary nesting. *Rejected.*
- *Rejected:* leaving `is="resource"` unmapped (the status quo) — blocks `crossStrategy` from
  ever carrying the directive, which is the open problem this fork closes.

## Fork 4 — relationship to #018 (async pagination)

**Crux:** how does a resource that *paginates* relate to this contract and the windowed-collection
seam? Refs: #018 (async pagination beyond load-more); the Loader Intent's `loadingMore` state
"composes the Windowed Collection Intent" ([intents.json:439](../src/_data/intents.json#L439));
TanStack [`useInfiniteQuery`/loaders](https://tanstack.com/router/v1/docs/framework/react/guide/data-loading).

- **(A — recommended) Pagination is a composition, deferred to #018.** A paginated resource is
  the Loader Intent's existing `loadingMore` state composed with Windowed Collection — *not* a new
  directive feature. `<Resource>`'s contract stays **single-resolve**; the resource merely
  participates in pagination via the seam Loader already has (Fork 2 routes it through Loader, so
  the `loadingMore` state is reachable without a directive change). The cursor-vs-offset / "load
  earlier" / windowing-plus-async design is **#018's** open work.
- **(B) Specify pagination in the directive contract now.** Resolves it in one place, but
  duplicates #018 and over-scopes a directive that should stay declarative-single-resolve.
  *Rejected.*
- *Rejected:* making the directive pagination-unaware (no Loader wiring) — would force a breaking
  directive change when #018 lands; Fork 2's Loader routing avoids that.

## Resolution — ratified 2026-06-11

All four forks ratified to their bold defaults. Net: `<Resource>` is a declarative composition of
the Loader Intent — no new intent, no parallel async model.

- **Fork 1 — A (named `loading`/`error` slots = Loader lifecycle states):** the slot vocabulary is
  the Loader Intent's existing `pending`/`error`/`success` states, mirroring the universal
  Suspense-fallback + ErrorBoundary-fallback split as two separate surfaces (no merged `fallback`).
- **Fork 2 — A (resolve through the Loader Intent + Resource Loader block):** the directive
  contributes the declarative trigger + slot surface; all state transitions, anti-flicker,
  version-token stale-drop, escalation, and hierarchy aggregation stay Loader's — cross-reference,
  don't duplicate; the block already exists.
- **Fork 3 — A (`use()`-style suspending read + Suspense/ErrorBoundary boundaries):** `is="resource"`
  lifts to a suspending read with the slot branches lifting to enclosing boundaries; `lift`/`lower`
  gain a `resource` correspondence and the lower path raises a `resource-suspends-on-read` lossy
  diagnostic (no inert HTML inverse).
- **Fork 4 — A (pagination = Loader `loadingMore` + Windowed Collection, deferred to #018):** the
  directive contract stays single-resolve; pagination is reachable through Loader's existing
  `loadingMore` seam (Fork 2's routing), so #018 lands without a breaking directive change.

**Follow-on builds (not yet scaffolded):**

- Wire `is="resource"` semantics: named slots → Loader states, resolve through Resource Loader block, add the `resource` lift/lower correspondence + lossy diagnostic in `crossStrategy` · story/size 2 · blockedBy: #070 → #337

## Context (preserved)

Until built, `<Resource>` remains a documented spelling with no runtime semantics beyond
building the inert `<template is="resource">` element (declarative-static, like every other
directive in the parked Axis-2 world). Surfaced while implementing #070. The four rulings are now
ratified (above); nothing is authored into the registries (intents.json / blocks.json /
crossStrategy.ts) by this resolution — that is the follow-on build. `blockedBy: ["070"]` is retained.
