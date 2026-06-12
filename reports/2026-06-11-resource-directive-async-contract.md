# `<Resource>` Directive — Async Contract (the net-new directive's semantics)

**Date**: 2026-06-11
**Backlog**: [#124 — Specify the `<Resource>` directive's async contract](/backlog/124-resource-directive-async-contract/)
**Parent**: [#070 — JSX directive sugar](/backlog/070-jsx-directive-sugar/) · **Companions**: [#078 — render-strategy lowering compiler](/backlog/078-render-strategy-lowering-compiler/), [#018 — async pagination beyond load-more](/backlog/018-dropdown-async-pagination-paradigm/)
**Adapter page**: `/adapters/jsx-adapter/`
**Companion report**: [reports/2026-06-03-jsx-adapter-feature-mapping.md](2026-06-03-jsx-adapter-feature-mapping.md)

---

## 1. The situation (grounded in the real tree)

The directive-sugar layer (#070) shipped three directives through **one registry** — `blocks/renderers/jsx/directives.ts:54`:

```ts
export const directiveRegistry: DirectiveDef[] = [
  { sugar: 'For',      is: 'for-each', props: { each: 'items' } },
  { sugar: 'Show',     is: 'if',       props: { when: 'condition' } },
  { sugar: 'Resource', is: 'resource', props: { from: 'from' } },   // ← net-new, no runtime
];
```

`For` and `Show` map to **real, existing** directives the lowering compiler understands —
`crossStrategy.ts` has `liftForEach`/`liftConditionals`/`lowerMaps`/`lowerConditionals`
(`crossStrategy.ts:88,107,153,167`) that round-trip `is="for-each"` ⇄ `.map()` and
`is="if"` ⇄ `&&`. **`is="resource"` appears in NONE of them.** `Resource` is currently a
pure spelling: `makeDirective` (`directives.ts:173`) builds the same inert
`<template is="resource" from="…">` DOM the canonical form builds, and that is *all* it does.
Nothing says what a resource *resolves to*, what surfaces it owns, or what it lowers to.

The platform already owns the missing pieces — they just aren't wired:

- **Loader Intent** (`intents.json:439`) is a full async state machine:
  `idle | pending | success | error | stale | filtering | loadingMore`
  (`intents.json` lifecycle-states block), with `escalation: none|warn|async`, version-token
  stale-resolve prevention, and hierarchy aggregation. It explicitly names a
  **`loadingMore`** state that "composes the Windowed Collection Intent" and a **`stale`**
  state ("showing previous data while a refresh is in progress").
- **Resource Loader** block (`blocks.json:203`, `implementsIntent: "loader"`) is the
  trait-based orchestrator that already implements that machine
  (`withSoftBlocking`/`withReplacement`/`withIndeterminate` traits).

So the contract is not invented from scratch — it is a **wiring decision**: bind the net-new
directive to the Loader Intent's existing vocabulary, define its slot surface, and give #078
a lowering target.

## 2. Prior-art survey (the four reference primitives)

Every mainstream async-resource primitive converges on the same shape — and it is the shape
WE's Loader Intent already encodes.

| System | Resolve primitive | Loading surface | Error surface | Stale / pagination |
|---|---|---|---|---|
| **SolidJS** | `createResource()` (read suspends) | `<Suspense fallback>` (nearest ancestor) | `<ErrorBoundary fallback>` (error thrown on read) | `resource.latest` keeps prior value; `<For>` over a resource |
| **React 19** | `use(promise)` (read suspends) | `<Suspense fallback>` | `<ErrorBoundary>` | `useTransition` keeps current UI during refresh |
| **TanStack Query** | `useSuspenseQuery` / `useInfiniteQuery` | Suspense boundary | Error boundary | "lagged data" keeps prior page; `fetchNextPage` |
| **React Router / Remix** | route `loader()` | route-level pending | `errorElement` | cursor/offset in the loader |

Three structural facts hold across all four:

1. **Loading and error are SEPARATE composable boundaries**, not two props on one element.
   Solid's `<Suspense>`+`<ErrorBoundary>`, React's `<Suspense>`+error boundary — the read
   *suspends* up to the nearest loading boundary and *throws* up to the nearest error
   boundary. They nest independently. (Sources below.)
2. **The resource read is the suspend point** — `use(promise)` / `createResource`'s accessor.
   That read is what a vdom strategy emits; it is the lowering target.
3. **Keeping prior content visible during a refresh is first-class** — Solid `.latest`,
   React `useTransition`, TanStack "lagged data". This is precisely WE's `stale` state
   ("showing previous data while a refresh is in progress", `intents.json`) — so WE does not
   need a new concept, it needs to *map onto* the one it has.

There is **no native `<resource>` element** — like tree-select, this is an ARIA/JS-composed
concern with no HTML substrate; the directive is the declarative spelling of the
suspend-on-read primitive.

## 3. The four forks (each grounded, each defaulted)

The item lists four axes as open questions. The survey + the existing Loader machine resolve
each to a defensible default. Full framing lives in the backlog item; the rulings:

### Fork 1 — slots / states surface → **named-slot branches mapping to Loader states**

`<Resource>` owns a **loading / error / fallback surface** via named slots, NOT a bespoke
child-directive DSL. The slot names are the **Loader Intent's existing lifecycle states**
(`intents.json`: `pending`, `error`, `success`, `stale`/`loadingMore`) — not freshly coined
ones. Default surface: `<template slot="loading">`, `<template slot="error">`, default
(unslotted) children = the resolved/success content. This mirrors Solid/React's
Suspense-fallback + ErrorBoundary-fallback split (two separate surfaces) while reusing WE's
own vocabulary, so a `<Resource>` is literally a declarative composition of the Loader state
machine. Rejected: folding loading+error into one `fallback` slot (loses the
Suspense/ErrorBoundary separation every library keeps); a child-`<template is="if">` DSL
(re-invents branching the slot model already gives).

### Fork 2 — Loader Intent wiring → **resolve THROUGH the Loader Intent; add nothing**

`from="@…"` is an injector/context ref (`directives.ts:57`, the `from` prop). The resource
resolves **through the Loader Intent's async lifecycle** (`intents.json:439`) and the
Resource Loader block (`blocks.json:203`) that already implements it — it is **not its own
state machine**. The directive contributes the *declarative trigger + slot surface*; the
state transitions, anti-flicker (entry-threshold + hold-floor), version-token stale-drop,
escalation, and hierarchy aggregation are all Loader's, unchanged. "Cross-reference, don't
duplicate" (the item's own words). Rejected: a standalone resource state machine (duplicates
Loader, drifts from the Resource Loader block, fragments the async story).

### Fork 3 — lowering correspondence (#078) → **lift/lower to a `use()`-style suspending read + boundary slots**

`crossStrategy.ts` lowers `is="for-each"`→`.map()` and `is="if"`→`&&` but has no resource
rule. The vdom equivalent `is="resource"` lifts to is the **suspending-read form**:
`const data = use(from)` (React `use()` / Solid `createResource` accessor), with the
`slot="loading"` / `slot="error"` branches lifting to the enclosing `<Suspense>` /
`<ErrorBoundary>` boundaries. So `lift`/`lower` gain a `resource` correspondence:
`<template is="resource" from="E"><...slots></template>` ⇄
`<Suspense fallback={…}><ErrorBoundary fallback={…}>{use(E)}…</ErrorBoundary></Suspense>`.
Because the read is async, the round-trip is flagged the same way the eager/reactive
interpolation boundary is (`crossStrategy.ts:124` `lossy` diagnostic) — a resource read has
suspense semantics with no inert HTML inverse, so it carries a `resource-suspends-on-read`
diagnostic on lower. Rejected: a bare `await` form (no boundary correspondence for the
loading/error slots; doesn't model suspension); leaving `is="resource"` unmapped (the item's
status quo — blocks `crossStrategy` from carrying it).

### Fork 4 — relationship to #018 (async pagination) → **paginated resource is a Loader `loadingMore` + Windowed Collection composition, deferred to #018**

A resource that paginates is **not a new directive feature** — it is the Loader Intent's
existing `loadingMore` state ("fetching the next page… composes the Windowed Collection
Intent", `intents.json`) composed with Windowed Collection. The `<Resource>` directive's
contract stays *single-resolve*; pagination is a composition the resource participates in,
and the cursor-vs-offset / "load earlier" / windowing-plus-async design is **#018's open
work**, not #124's. #124 only commits that the directive's resolve flows through the Loader
lifecycle (Fork 2), which already *has* the `loadingMore` seam — so #018 can attach without a
directive change. Rejected: specifying pagination *in* the directive contract now (duplicates
#018, over-scopes a directive that should stay declarative-single-resolve); making the
directive pagination-unaware (would force a breaking change when #018 lands).

## 4. Net of the four rulings

`<Resource>` becomes a **declarative composition of the Loader Intent**: a suspend-on-read
trigger (`from`) with named loading/error/success slots that *are* Loader states, resolving
through the existing Resource Loader orchestrator, lowering to a `use()`-style suspending read
with `<Suspense>`/`<ErrorBoundary>` boundaries, and participating in (not owning) pagination
via Loader's `loadingMore` + Windowed Collection (deferred to #018). No new state machine, no
new intent — the net-new directive is wired to vocabulary the platform already ships.

The decision stays `status: open` pending ratification; nothing is authored into the registries
by this preparation.

## Cross-references

- Decision: [#124 — `<Resource>` async contract](/backlog/124-resource-directive-async-contract/)
- Parent: [#070 — JSX directive sugar](/backlog/070-jsx-directive-sugar/) · `blocks/renderers/jsx/directives.ts`
- Lowering: [#078 — render-strategy lowering compiler](/backlog/078-render-strategy-lowering-compiler/) · `blocks/renderers/jsx/render-strategy/crossStrategy.ts`
- Pagination: [#018 — async pagination beyond load-more](/backlog/018-dropdown-async-pagination-paradigm/)
- Composes: [Loader Intent](/intents/loader/) (`intents.json:439`) · [Resource Loader block](/blocks/resource-loader/) (`blocks.json:203`) · [Windowed Collection](/intents/windowed-collection/)
- Companion report: [JSX Adapter feature mapping](2026-06-03-jsx-adapter-feature-mapping.md)

### Sources (prior art)

- [SolidJS `createResource`](https://docs.solidjs.com/reference/basic-reactivity/create-resource) — read suspends / errors throw to `<ErrorBoundary>`; `.latest` keeps prior value
- [SolidJS — fetching data (Suspense + ErrorBoundary)](https://docs.solidjs.com/guides/fetching-data)
- [React 19 `use()` + Suspense](https://react.dev/blog/2024/12/05/react-19) · [`<Suspense>`](https://react.dev/reference/react/Suspense) · [`useTransition`](https://react.dev/reference/react/useTransition)
- [TanStack Query — `useSuspenseQuery` / lagged data / `useInfiniteQuery`](https://tanstack.com/query/latest/docs/framework/react/comparison)
- [TanStack Router — data loading (loaders + Suspense)](https://tanstack.com/router/v1/docs/framework/react/guide/data-loading)
