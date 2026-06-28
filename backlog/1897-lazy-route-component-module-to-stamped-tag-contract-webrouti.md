---
kind: decision
parent: "1684"
status: resolved
relatedItems: ["1720", "1823", "1731", "227"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
preparedDate: "2026-06-28"
relatedReport: reports/2026-06-28-webrouting-lazy-component-module-to-tag.md
codifiedIn: "docs/agent/platform-decisions.md#lazy-route-component-auto-define-default"
tags: [webrouting, route-view, lazy-component, runtime-ingestion, auto-define]
---

# Lazy route:component module-to-stamped-tag contract (webrouting runtime ingestion)

Prepared and ready to ratify. **Reframed by the prep: this is not a three-way fork — it is the ratified
`auto-define` configurable dimension applied to lazy route components, so the call is "set the router's
default value," not "pick one of three mechanisms"** (the same fork→dimension reframe #1823's Fork 3 took).
Recommended stance: **on-import self-registration with the tag carried on the route value** — the lazy
module defines its own element as a pure import side-effect, the route object carries the `tag`, and the
engine `createElement(tag)`s and **never calls `customElements.define`** (mirroring the ratified block
loader, `fui:workbench/loader.ts:56-68`). **Per `#config-extends-platform-default`, the route-engine code
itself holds NO baked default — it derives the auto-define strategy from resolved platform settings; this
on-import value is the stance we ship in the platform-preset flavor, not a constant in the engine.**
`engine-defines` stays a **per-scope override** on the auto-define dimension, never foreclosed. Grounded in
[the prep report](../reports/2026-06-28-webrouting-lazy-component-module-to-tag.md) and
[the research topic](/research/webrouting-lazy-component-module-to-tag/).

## Grounding digest

#1823 (ratified) settled that a runtime route object carries `component` = a `() => import()` thunk (JS) /
bare module-specifier string (DOM), but explicitly **deferred how that module becomes a stampable tag** —
this item. The engine stamps a matched route by cloning a `<template>`
(`templateDef.template.content.cloneNode(true)`, `fui:blocks/router/elements/RouteViewElement.ts:498`),
inside the **sync** `#stampAllRoutes` (`fui:blocks/router/elements/RouteViewElement.ts:461-524`); a
`RouteDefinition` carries a concrete `template: HTMLTemplateElement`
(`we:blocks/router/types.ts:218-227`) and matching is sync (`matchRoute`,
`we:blocks/router/types.ts:240-266`). A lazy `component` yields a **module, not a template**, and the load
is **async** — so the engine needs another element source. `route:component` / `RouteComponentRef` /
`customContexts:routes` are **not built yet** (grep-empty across `we:blocks/router/` and
`fui:blocks/router/`; #1720 is the blocked build), so this is a **contract decision over not-yet-shipped
code**.

## Axis framing

The axis is **which `auto-define` strategy the route engine uses by default to turn a lazy module into a
stamped element**, and **where the tag comes from**. The platform already owns this axis: the anchor
[`#config-extends-platform-default`](../docs/agent/platform-decisions.md) names `auto-define` —
"explicit / eager-barrel / **on-import** / on-first-use / build-parse / declarative-map / convention / SSR"
(`we:docs/agent/platform-decisions.md:1249-1257`, lineage #227) — as a **ratified configurable strategy
dimension** with an open / default-less `CustomAutoDefineRegistry`. So the module→tag question is **a
default-on-that-dimension call, not a standalone either/or** (dimension-vs-fixed-mechanic: both
`on-import` and `engine-defines` are legitimate end-states the platform keeps configurable). The decisive
in-house precedent is the block loader: `await shape.load()` (or `import(shape.servedUrl)`) then
`createElement(shape.tag)` — the module **self-registers as an import side-effect**, the **tag rides on the
descriptor** (`shape.tag`, sibling of `shape.load` — *not* read off the module), engine **never defines**
(`fui:workbench/loader.ts:56-68`, ratified #1731). The MaaS serve-path invariant says the same ("the served
bytes register their own element as an import side effect",
`we:docs/agent/platform-decisions.md:1118-1120`). The custom-element-native routers (Vaadin: route carries
a tag string + a self-registering `action` import; `@lit-labs/router`) agree; the virtual-DOM routers
(React/Vue/Angular) default-export the component but have no platform tag registry, so are weak analogs for
`engine-defines`.

## Recommended path at a glance

| Fork | Recommended default | Main alternative / override | Confidence |
|------|--------------------|------------------------------|------------|
| Fork 1 — module→tag contract *(reframed: auto-define dimension, not a fork)* | **(a) on-import self-register + tag-on-route; engine `createElement(tag)`, never defines** — native-first / most-permissive value of the auto-define dimension; mirrors `fui:workbench/loader.ts:56-68` | **(b) engine-defines** (default-export ctor → engine `customElements.define`) = a **per-scope override** on the dimension, never foreclosed; **(c) thunk-returns-tag** folds in as a JS shorthand of (a) | High |

## Fork 1 — the lazy module→tag contract (the auto-define dimension applied to route components)

**Fork-existence: FAILS the either/or test — this is a configurable dimension, not a fork.** Neither branch
is *broken*: `on-import` self-registration and `engine-defines` are **both legitimate end-states already
ratified as named points on the `auto-define` configurable dimension**
(`we:docs/agent/platform-decisions.md:1249-1257`, #227). By dimension-vs-fixed-mechanic (both branches
legitimate ⇒ expose the dimension), the call is to **set the route engine's *default*** on that dimension —
exactly the reframe #1823's Fork 3 took (fork → dimension via config-extends-default). The original
three-way framing is dissolved: (a) is the default, (b) is the override, (c) is a spelling of (a).

**Options.**
- **(a) on-import self-register + tag-on-route** *(default)* — the lazy view module **defines its own
  element** as a pure import side-effect (the dominant ESM idiom); the **route object carries the `tag`**
  (a companion field; in the DOM form a companion attr or `route:component` doubling as the tag in the
  string case); the engine `await`s the load, then `createElement(tag)` — and **never calls
  `customElements.define`**. This is the native-first / most-permissive value of the auto-define dimension
  and mirrors the ratified loader field-for-field (`load` + `tag` → async resolve → sync `create()`,
  `fui:workbench/loader.ts:56-68`). **The route-engine code carries no baked default** — it reads the
  resolved auto-define strategy from platform settings; (a) is the value the **platform-preset flavor**
  ships (`#config-extends-platform-default`), so a scope can re-set it without touching engine code.
- **(b) engine-defines** — the module's **default export is the constructor** and the **engine** derives a
  stable tag and calls `customElements.define(tag, Ctor)`. **Not excluded — it is the non-default strategy**
  of the same auto-define dimension, reachable as a **per-scope override** through `CustomAutoDefineRegistry`
  / config-extends-default. It is *not* the default because engine-side define must invent a tag
  (generation/collision policy), is **non-idempotent across navigations** (re-`define` throws) and
  **double-defines if the module also self-registers** (the dominant idiom), and strips the element of its
  authored identity — all of which the native-first default avoids.
- **(c) thunk-returns-tag** — the JS thunk resolves directly to the tag string. **Folded into (a) as a
  JS-only shorthand**: it is the same "module owns define, tag comes from the route side" contract, just
  with the tag arriving as the thunk's resolved value instead of a sibling field. No DOM analog (a DOM
  specifier can't "return"), so it is a convenience, not the canonical cross-form contract.

**Sub-decision (settled by the skeptic) — tag-on-route, NOT a `mod.tag` module export.** The prep first
proposed the engine read a conventional `mod.tag` export. That is **refuted and dropped**: neither cited
precedent reads the tag off the module — Vaadin carries it on the route, and the in-house loader carries it
on the descriptor (`shape.tag` is a sibling of `shape.load`, `fui:workbench/loader.ts:60-67`) — and a
`mod.tag` export is a fabricated convention that **force-fails on third-party elements** (you cannot add an
export to vendor bytes, but you can write the tag on your own route). The tag rides on the **route value**.

**Code example** (the contract turns on a concrete shape, so it is part of the prepared fork). Default (a),
modeled on `loadBlockShape`:

```ts
// we: the runtime route-object shape gains a companion `tag` alongside the #1823 `component` ref.
interface RuntimeRouteObject {
  path: string;
  component?: () => Promise<unknown> | string;  // #1823: thunk (JS) | bare specifier (DOM) — self-registers
  tag?: string;                                  // #1897 (a): the custom-element tag the engine stamps
  // …guard?, loader?, outlet?, isErrorBoundary? per #1823
}

// JS / runtime form — module self-registers on import; route carries the tag:
{ path: '/reports', component: () => import('./views/reports.js'), tag: 'reports-view' }
```

```html
<!-- DOM / serializable form — module-specifier + companion tag attr (tag-on-route, no module introspection): -->
<template route="/reports" route:component="./views/reports.js" route:component-tag="reports-view"></template>
```

```ts
// Engine resolution — mirrors fui:workbench/loader.ts:56-68 (async resolve → sync create()); engine NEVER defines:
async function resolveRouteView(r: RuntimeRouteObject): Promise<{ create: () => HTMLElement }> {
  await (typeof r.component === 'function' ? r.component() : import(r.component!)); // side-effect self-register
  const tag = r.tag!;                                  // (c) shorthand: a thunk may resolve to `tag` instead
  return { create: () => document.createElement(tag) };
}
// then stamp `create()` in place of templateDef.template.content.cloneNode (fui:…/RouteViewElement.ts:498)
```

Override (b), the non-default strategy, reachable per-scope (not built ahead of a consumer):

```ts
// A project that wants engine-defines registers it on the auto-define dimension (CustomAutoDefineRegistry /
// config-extends-default) — the route module then default-exports a bare constructor and the engine defines it.
{ path: '/reports', component: () => import('./views/reports.js') /* default export = ctor; no tag */ }
```

**Skeptic:** MERIT **SURVIVES-WITH-AMENDMENT** — the core ("module self-registers, engine never defines on
the default path") held; the prep's `mod.tag`-export sub-default was **refuted** (no prior art; force-fails
third-party elements) and replaced with **tag-on-route** (Vaadin + `fui:workbench/loader.ts` + #1823 shape).
STATUTE **COLLISION FOUND → reconciled**: `#config-extends-platform-default` already governs `auto-define` as
a configurable dimension (#227), so the ruling is worded as **the route engine's default, not "engine never
defines" as an invariant** (which would foreclose the `engine-defines` strategy), and `codifiedIn` will
**instance** that anchor rather than author a standalone route-only auto-define rule.

## Supported by default (not decisions)

- **Async stamp wiring** — the match→stamp path gains an `await` that resolves a matched route's `component`
  ref to a `create()` factory (the `loadBlockShape` shape) before stamping; template routes are unchanged.
  No coherent "stamp-then-load" alternative is on the table (the load must finish first), so this is a
  mechanical consequence, not a fork.
- **Route-context delivery to the stamped element** — params/data still flow via the injector
  `customContexts:route` set on the stamp target (`fui:blocks/router/elements/RouteViewElement.ts:500-505`);
  the stamped custom element reads it via DI exactly like template content. No new channel.
- **template/component exclusivity** — a route carries a `template` *or* a `component`, never both
  (view-source is exclusive).

## Out of scope (deferred, not a fork)

- **Loading-state / suspense UX** (a placeholder while the module imports) — the baseline is "load-then-stamp"
  per the digest; a suspense slot is a **separate future card under #1720**, not part of this contract.
- **Attribute/property projection of params onto the stamped element** (e.g. `<user-detail user-id="42">`) —
  an enhancement over the DI channel, not required by the module→tag contract; future, if a consumer asks.

## Context

- **Blocks:** #1720 (the lazy half of webrouting runtime ingestion). Its runtime-object-ingestion half is
  fully specified by #1823 and build-ready independently; the lazy-component stamp builds once this contract
  is ratified.
- **Lineage:** parent epic #1684; sibling #1823 (ratified the route-object shape + `route:component` ref,
  deferred this); precedent #1731 / `fui:workbench/loader.ts` (self-register-on-import + tag-on-descriptor +
  `createElement`); statute #227 / `#config-extends-platform-default` (the auto-define dimension this
  instances).
- **On ratify, `codifiedIn`** should **instance** `#config-extends-platform-default`
  (`we:docs/agent/platform-decisions.md`), extending the `#webrouting-runtime-route-ingestion` cluster — the
  **platform-preset flavor** sets the auto-define dimension to **on-import self-register + tag-on-route**
  while the **route-engine code stays default-less** (derives the strategy from resolved settings); **not** a
  standalone route-only auto-define rule, and **not** an "engine never defines" invariant (that would
  foreclose the `engine-defines` per-scope override).
