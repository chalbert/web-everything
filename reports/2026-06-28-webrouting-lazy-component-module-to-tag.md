# webrouting lazy `route:component` — module→stamped-tag contract (prep for #1897)

**Date:** 2026-06-28 · **Item:** #1897 (decision, parent epic #1684, blocks #1720) · **Sibling:** #1823 (ratified the runtime route-object shape + `route:component` ref but deferred *this* question).

## The question #1823 left open

#1823 settled that a runtime route object carries `component` = a `() => import()` thunk (JS) / bare
module-specifier string (DOM), resolved name-by-DI-default / inline-override. It explicitly did **not**
settle **how the imported module becomes a stampable custom-element tag.** That is #1897.

The engine stamps a matched route by cloning a `<template>`:
`templateDef.template.content.cloneNode(true)` (`fui:blocks/router/elements/RouteViewElement.ts:498`),
inside the sync `#stampAllRoutes` (`fui:blocks/router/elements/RouteViewElement.ts:461-524`). A
`RouteDefinition` carries a concrete `template: HTMLTemplateElement` set from the `<template route>` node in
`parseRouteDefinitions` (`we:blocks/router/types.ts:218-227`); matching is sync (`matchRoute`,
`we:blocks/router/types.ts:240-266`). A lazy `component` yields a **module**, not a template — so the
engine needs another way to obtain a renderable element, and the load is **async** while match+stamp are
sync.

`route:component`, `RouteComponentRef`, and `customContexts:routes` are **not built yet** (grep is empty
across `we:blocks/router/` and `fui:blocks/router/`; #1720 is the blocked build). So #1897 is a **contract
decision over not-yet-shipped code** — it fixes what a lazy view module must expose, before #1720 wires it.

## Prior-art delta (focused on module→element mapping, not "is the import inline")

#1823's survey already established the import is inline. The **new** delta is *how the loaded module becomes
a rendered element*, split by whether the framework has a platform tag registry:

| Router | Module→view contract | Who calls `define`? |
|--------|----------------------|---------------------|
| **Vaadin Router** (custom-element-native) | route carries a tag-name string **+** a separate `action` import; the imported module **self-registers** | the **module** (side-effect) |
| **@lit-labs/router** | an async `enter` imports for side-effect; the `render` template names the tag | the **module** |
| React Router `lazy` | module exports `Component`/`element` | n/a — no platform tag registry |
| Vue Router | `component:` thunk, **default export** is the component | Vue, internally |
| Angular | `loadComponent:` thunk **returns the class** | Angular, internally |

**Reading:** the **custom-element-native** routers (Vaadin, lit-labs) — the only true analogs, since WE
stamps real `customElements`-registered tags — both put `customElements.define` in the **module** and have
the engine stamp a **tag carried on the route**. The virtual-DOM routers default-export the component and
let the framework define it *internally*, but they have **no platform tag registry**, so they are weak
analogs for an "engine defines" option.

**Decisive in-house precedent.** WE already ratified exactly this shape for a sibling concern (#1731). The
block loader runs the import step then returns a tag factory: for a native block `await shape.load()` then
`createElement(shape.tag)`; for a served block `await import(shape.servedUrl)` then `createElement(shape.tag)`
(`fui:workbench/loader.ts:56-68`). The module **self-registers as an import side-effect**, the **tag rides
on the descriptor** (`shape.tag`, a sibling of `shape.load`/`shape.servedUrl` — *not* read off the module),
and the engine **never calls `customElements.define`**. The MaaS serve-path invariant says the same: "the
served bytes register their own element as an import side effect" (anchor
`#maas-serves-self-contained-modules-only`, `we:docs/agent/platform-decisions.md:1118-1120`).

## Where the tag comes from — on the route, NOT off the module (skeptic-corrected)

The prep first proposed the engine read a conventional `mod.tag` export after `await import()`. A
refute-only skeptic **refuted that sub-default** and it is dropped: neither cited precedent reads the tag off
the module — both carry it on the route/descriptor (`fui:workbench/loader.ts:60-67`), and a `mod.tag` export
is a fabricated convention that **force-fails on third-party elements** (you can't add an export to vendor
bytes, but you can write the tag on your own route). **Amended default: the tag rides on the route value** (a
route-object `tag` field / companion DOM attr — exactly the item's original (a) "the route carries the
tag"); the module self-registers purely as an import side-effect; the engine `createElement(tag)`s and
**never defines**. The JS thunk may instead resolve directly to the tag string (option (c)) as a shorthand.
This mirrors `loadBlockShape` field-for-field (`load` + `tag` → async resolve → sync `create()` factory) and
honors #1823's `component`-as-module-ref by *adding* a companion tag, not by overloading `component`.

## (b) is the non-default strategy, not an excluded branch (statute reconciliation)

The prep first framed engine-owns-`define` as "broken/excluded." The skeptic's **statute-overlap pass found
a collision** that corrects this. The anchor `#config-extends-platform-default`
(`we:docs/agent/platform-decisions.md:1249-1257`) names **auto-define** — "explicit / eager-barrel /
**on-import** / on-first-use / build-parse / declarative-map / **convention** / SSR" — as a **ratified
configurable strategy dimension** (lineage #227), with an open / default-less `CustomAutoDefineRegistry`.
Engine-side define *is* one named strategy on that dimension; module-self-register-on-import is another. So
#1897 must **not** codify "the engine NEVER defines" as an invariant — that hard-bakes `on-import` and
forecloses `engine-defines`, the exact anti-pattern the anchor forbids. Reconciliation: #1897 sets the
**route engine's default** on that dimension to the native-first / most-permissive value
(`on-import`/self-register, tag-on-route); `engine-defines` stays a **per-scope override** reachable through
`CustomAutoDefineRegistry` / config-extends-default — never foreclosed. By the dimension-vs-fixed-mechanic
test (both branches legitimate ⇒ expose the dimension), the module→tag question is therefore **a
dimension-default call, not a three-way either/or** — the same reframe #1823's Fork 3 took (fork → dimension
via config-extends-default). `codifiedIn` must **instance** `#config-extends-platform-default` (cite #227),
not author a standalone route-only auto-define rule.

## Async-stamp consequence (mechanical, not a fork)

The load must complete before the stamp. The match→stamp path gains an `await` that resolves a matched
route's `component` ref to a concrete `create()` factory — exactly `loadBlockShape`'s async-resolve →
sync-`create()` shape (`fui:workbench/loader.ts:56-68`) — then stamps `createElement(tag)` in place of
`template.content.cloneNode` (`fui:blocks/router/elements/RouteViewElement.ts:498`); template routes are
unchanged. A route has a `template` **or** a `component`, never both (view-source is exclusive). **Loading
UX (placeholder/suspense while importing) is explicitly out of scope** — "load-then-stamp" is the baseline;
a suspense slot is a separate future card under #1720. Route context (params/data) still flows via the
injector `customContexts:route` set on the stamp target (`fui:blocks/router/elements/RouteViewElement.ts:500-505`)
— the stamped custom element reads it via DI exactly like template content, so **context delivery is
supported by default**, not a fork.

## Recommended path

**Not a three-way fork — the auto-define configurable dimension applied to lazy route components.** #1897
sets the **router's default**: native-first **on-import self-registration with the tag carried on the route
value**, engine `createElement(tag)`, engine never defines on the default path (mirrors
`fui:workbench/loader.ts:56-68`). `engine-defines` (option (b)) is the **per-scope override** on the
auto-define dimension, never foreclosed; option (c) folds in as the JS thunk resolving to the tag string.
`codifiedIn` **instances** `#config-extends-platform-default` (#227), worded as a default not a prohibition.
Async-stamp wiring, context delivery, and template/component exclusivity are supported-by-default;
loading-UX is out of scope.
