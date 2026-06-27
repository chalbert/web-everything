---
kind: decision
parent: "1684"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#webrouting-runtime-route-ingestion"
preparedDate: "2026-06-26"
relatedReport: reports/2026-06-26-webrouting-runtime-route-ingestion.md
tags: [webrouting]
---

# webrouting runtime/dynamic route-ingestion mechanism (provider shape, lazy-attr, merge order)

Prepared and ready to ratify. `route-view` ingests routes only from static `<template route>` children
today; #1720 wants a runtime path (dynamic route objects via context + lazy component-from-URL). The
recommended path: **reuse the injector-context DI mechanism** for dynamic routes (a new
`customContexts:routes` key carrying a runtime route-object shape — *not* the #1685 serializable
projection, which a skeptic pass proved cannot serve as the engine input), express the lazy component as
an **inline `() => import()` thunk (JS) / bare specifier string (DOM) on a `route:component` attr** (no
name-registry), and **merge static-first / first-match-wins with a shadowing diagnostic**. Grounded in
[the prep report](../reports/2026-06-26-webrouting-runtime-route-ingestion.md) and
[the research topic](/research/webrouting-runtime-route-ingestion/).

The axis is *how the runtime path reuses (or extends) the mechanisms the static path already has*. The
static path resolves loader/guard late, by **name**, through the injector context seam
(`InjectorRoot.getProviderOf(host, 'customContexts:routeLoader')` → a name→fn map,
`fui:blocks/router/elements/RouteViewElement.ts:484-493`), matches **declaration-order / first-match-wins**
(`we:blocks/router/types.ts:243-266`), and stamps a route's `template.content.cloneNode`
(`fui:blocks/router/elements/RouteViewElement.ts:498`). The #1685 `RouteMap`
(`we:blocks/router/route-map.ts:28-159`) is a **faithful output projection** that *drops* the
non-serializable `pattern`/`template` and rejects unknown keys via a closed `ENTRY_KEYS` set — so it is the
serialization contract, not the live engine input.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|------------|
| Fork 1 — provider shape ✅ **RATIFIED (a) 2026-06-27** | **(a) Reuse the injector mechanism** — new `customContexts:routes` key, runtime route-object shape carrying a component/template ref | (b) A brand-new provider contract | Med-high (the #1685-as-input branch is refuted) |
| Fork 2 — lazy component ✅ **RATIFIED (a) + amendments 2026-06-27** | **(a) `route:component` attr; inline `() => import()` thunk (JS) + bare specifier (DOM); no *mandatory* registry; data-loader independent/eager** | (b) `customContexts:routeModule` name-registry | Med |
| Fork 3 — merge order ✅ **RATIFIED (dimension via config-extends-default) 2026-06-27** | **`mergePrecedence` config field; platform default = static-first concat, first-match-wins, + shadowing diagnostic; project config extends to override** | per-route `priority` field (rejected); a bespoke per-view/per-provider knob (rejected — unused knob) | High |

## Fork 1 — context-provider shape for dynamic route objects

**Fork-existence:** a real either/or — (a) and (b) are mutually-exclusive wire shapes for the same seam, and
the *originally-proposed* "reuse the #1685 serializable map as the input" is the **flawed/excluded** branch:
`buildRouteMap` drops `pattern`/`template` (`we:blocks/router/route-map.ts:57-88`) and the closed
`ENTRY_KEYS` validator rejects a `module`/component field (`:91-159`) — but the engine *must* have a
`template`/component to stamp (`fui:blocks/router/elements/RouteViewElement.ts:498`). It is provably broken
as input, not merely worse.

**Options.**
- **(a) Reuse the injector mechanism** *(default)* — a new sibling key `customContexts:routes` set on an
  injector (exactly like `customContexts:routeLoader`), whose value is a **runtime route-object shape**:
  `{ path, guard?, guardLeave?, loader?, outlet?, isErrorBoundary?, component? }` where `guard`/`loader` stay
  **names** (resolved through the existing maps) and `component` is the Fork-2 lazy ref. The DI mechanism is
  unchanged; only a new value shape is added.
- **(b) A brand-new provider contract** — a separate registration API carrying inline functions on route
  objects (RR/Vue style). *Rejected* — forks the seam and abandons the name-indirection that keeps callables
  in the existing loader/guard maps; no payoff over (a).

**Sub-fork (folded from the skeptic):** because `getProviderOf` is **first-found-wins, no merge**
(`fui:plugs/webinjectors/InjectorRoot.ts:115-126`), a nested `route-view` would silently shadow a parent's
route table. Ruling: the runtime path must **merge** the resolved `customContexts:routes` with the local
static parse rather than let first-found replace it (the loader-map precedent does not transfer — shadowing
a fn-map is benign, shadowing the route set is data loss). Flagged for the build.

**Skeptic:** REFUTED → flipped. The original default (#1685 schema as runtime input) was refuted on the
dropped-`template` + closed-key + table-shadowing grounds above; the default is now a distinct runtime shape
over the reused mechanism, with the merge-not-shadow rule folded in.

**Ratified 2026-06-27 → (a).** New `customContexts:routes` injector key carrying the runtime route-object
shape `{ path, guard?, guardLeave?, loader?, outlet?, isErrorBoundary?, component? }`; guard/loader stay
names through the existing maps; `component` is the Fork-2 ref. The **merge-not-shadow** sub-fork is part of
the ruling: the runtime path merges the resolved `customContexts:routes` with the local static parse rather
than letting `getProviderOf`'s first-found-wins replace it (verified first-found-wins at
`fui:plugs/webinjectors/InjectorRoot.ts:115-126`). Grounding re-verified at ratify: `route:component` free
and engine stamps `template.content.cloneNode` (`we:blocks/router/types.ts:223-227`,
`fui:blocks/router/elements/RouteViewElement.ts:498`). Forks 2 + 3 remain open.

## Fork 2 — lazy component-from-URL

**Fork-existence:** a genuine either/or on how the deferred module is referenced; (b) is the *flawed* branch
in the JS/runtime path — a name-registry adds a registration step and an indirection lookup for zero gain
where an inline thunk is trivially expressible (every mainstream router inlines it). The name-indirection is
a DOM-attribute artifact; #1720's path is JS-native.

**Crux.** No collision: `we:blocks/router/types.ts:223-227` already defines `route:guard`,
`route:guard:leave`, `route:loader`, `route:outlet`, `route:error` — `route:component` is free. `route:loader`
loads **data** (eager); the lazy **view** module is a new, independent concern.

**Options.**
- **(a) `route:component`, dual-form, no registry** *(default)* — the JS/runtime route object carries an
  inline `component: () => import(…)` thunk; the serializable/DOM form carries a bare module-specifier
  string on `route:component`; the data `route:loader` stays independent and eager. Named `route:component`
  (not `route:module`) to disambiguate from the data loader and match Angular/Vue naming.
- **(b) `customContexts:routeModule` name-registry** — resolve `route:module` to a named factory in a new
  provider map (mirroring `route:loader`). *Rejected* — ceremony with no payoff in the JS path; only buys a
  DI override no consumer has asked for.

**Skeptic:** SURVIVES-WITH-AMENDMENT → folded. The attack (provider-map is needless ceremony; inline thunk
matches all prior art) is adopted as the default; the rename to `route:component` resolves the
data-vs-view ambiguity the attack flagged.

**Ratified 2026-06-27 → (a) with two amendments.** `route:component` inline `() => import()` thunk (JS) /
bare specifier (DOM) is the default form; no *mandatory* registry. Two amendments folded in from the
ratification discussion (most-flexible-default — restriction is opt-in, not the default):

1. **Resolution is DI-by-name *default*, inline-fn *override*, for both loader and component.** A route
   object may reference a callable by **name** → resolved through the inherited injector DI maps
   (`customContexts:routeLoader`/`routeGuard`, and an optional `customContexts:routeComponent` map for the
   view) — this is the default, inherited path; **or** carry an **inline function/thunk directly** on the
   route object → used as-is, overriding DI. The serializable/DOM form stays string-only (names +
   specifiers); inline fns are a JS-runtime-only affordance that the #1685 projection drops, exactly like
   the component thunk — so the serialization contract is untouched.
2. **A direct, code-driven route-definition surface — a settable `routes` property on `<route-view>`.**
   The getter already exists (`fui:blocks/router/elements/RouteViewElement.ts:48`, today populated from
   `parseRouteDefinitions` in `connectedCallback:83`); making it settable lets code **pass the full
   runtime route-object array straight to the component** — a third authoring surface alongside (i) DOM
   `<template route>` static authoring and (ii) the Fork-1 `customContexts:routes` injector provider. The
   direct property and the injector provider are both *code-driven runtime* inputs; both merge with the
   DOM static parse under the Fork-3 order (static-first, first-match-wins, shadowing diagnostic).

**Skeptic (ratify-turn re-attack):** the inline-fn / direct-`routes` amendments don't reintroduce the
rejected (b) ceremony — (b) was rejected as a *mandatory* registry; here name-DI and inline-prop are both
*optional* and the route object picks whichever it carries. The serialization contract holds (DOM form
string-only). Attack does not land.

## Fork 3 — static/dynamic merge (precedence) order

**REFRAMED in the ratification discussion (2026-06-27): this is not a real fork — it is a configurable
dimension.** The original framing called static-wins vs dynamic-wins a mutually-exclusive either/or. It
fails the fork-existence test: **neither branch is flawed, and they coexist as a setting.** Static-first
(DOM canonical, runtime fills gaps) is a legit end-state for authored apps; dynamic-first (runtime overrides
the authored base) is an *equally* legit end-state for plugin systems, feature-flag / A-B route swaps, and
auth-gated overrides. By the dimension-vs-fixed-mechanic test (both branches legit ⇒ expose the dimension),
merge precedence is **configurable**, not a one-true-order call. The prep half-saw this (its skeptic's
"flip to per-provider opt-in" amendment *is* a knob) but kept the fork-with-a-gate framing.

**Crux.** The engine is declaration-order, first-match-wins (`we:blocks/router/types.ts:243-266`); there is
no specificity tier, so *one* ordered list must be produced — but *how* it is ordered is a config value, not
a fixed mechanic.

**The dimension is delivered by the config-extends-default mechanism — no bespoke knob, nothing deferred.**
Per the config-extends-platform-default doctrine (the router stays *default-less*; defaults live in a
platform config that a project config extends — see `we:docs/agent/platform-decisions.md` and the #1780/#1702
three-layer carve), merge-precedence is simply a **field in the platform default config**, *not* a new
per-view attribute or per-provider flag. Adding an unused knob ahead of a consumer is the exact anti-pattern;
so there is **no "design the knob" task and nothing to defer to #1720.**
- **Platform default value:** `mergePrecedence: static-first` — static-first concatenation, first-match-wins,
  **+ a `console.warn` shadowing diagnostic** (mirroring `[Router] Invalid route pattern`,
  `we:blocks/router/types.ts:213`) so silent data loss can't hide. Least-surprise; preserves #1685's
  "DOM is canonical authoring SoT". Confidence: high.
- **Override path:** a project config *extends* the platform config and sets the field (e.g. `dynamic-first`)
  if an app genuinely needs runtime to win. No API is built ahead of that consumer — the consumer just sets a
  config value the platform default already declares. #1720, if it needs dynamic-first, sets the field; it
  carries no knob-design task.

**(b) An explicit per-route `priority` field** stays *rejected* — net-new schema surface, layered onto an
order-based engine with no specificity ranking; it compounds order-vs-rank confusion. Precedence is one
config value, not a per-route rank.

**Skeptic:** SURVIVES-WITH-AMENDMENT → folded, then REFRAMED. The original attack (static-wins forecloses
runtime override; the "disjoint sets" premise is unenforced) is fully answered: the diagnostic ships in the
default, and runtime-override is reachable by *extending the platform config* (set `mergePrecedence`), not
foreclosed and not a new knob.

**Ratified 2026-06-27 → dimension via config-extends-default.** `mergePrecedence` is a platform-default
config field; default `static-first` (static-first concatenation, first-match-wins, + `console.warn`
shadowing diagnostic); a project config extends the platform default to override (`dynamic-first`). The
router stays default-less; no bespoke per-view/per-provider knob is built. All three forks now ratified.

## Supported by default (not decisions)

- **Name-indirection for loader/guard** — unchanged; dynamic routes carry loader/guard **names** resolved
  through the existing `customContexts:routeLoader`/`routeGuard` maps.
- **#1685 as the serialization contract** — stays the wire/transport projection; this decision does not
  touch it (it only rules it out as the live engine input).

## Examples

Grounded in the real injector API: providers are set with `injector.set('customContexts:<key>', value)`
(`fui:plugs/webinjectors/Injector.ts:122`) and read with `InjectorRoot.getProviderOf(host, 'customContexts:<key>')`
(`fui:plugs/webinjectors/InjectorRoot.ts:115-126`). `customContexts:routeLoader`/`routeGuard` are today
**name→fn maps** (`fui:blocks/router/elements/RouteViewElement.ts:446-452`); the new `customContexts:routes`
adds an **ordered route-object list** alongside them.

### Fork 1 (ratified) — provide dynamic routes via the injector

```ts
import InjectorRoot from '@frontierui/webinjectors';

// Existing name→fn maps stay exactly as they are — callables resolve by name.
injector.set('customContexts:routeLoader', { userLoader: ({ params }) => fetchUser(params.id) });
injector.set('customContexts:routeGuard',  { requireAuth: () => isLoggedIn() });

// NEW: an ordered list of runtime route objects. guard/loader are NAMES (resolved
// through the maps above); `component` is the Fork-2 lazy ref.
injector.set('customContexts:routes', [
  { path: '/users/:id', loader: 'userLoader', guard: 'requireAuth',
    component: () => import('./views/user-detail.js') },
  { path: '/settings', component: () => import('./views/settings.js') },
]);
```

The runtime route-object shape (WE-owned contract type). Per the Fork-2 amendment, each callable is
**name-by-DI *or* inline-fn** — the route object carries whichever it wants; a name resolves through the
inherited injector map (default), an inline fn overrides DI:

```ts
type Named<Fn> = string | Fn;          // a name (→ injector DI map) OR an inline override

interface RuntimeRouteObject {
  path: string;                        // template, not a concrete URL
  guard?: Named<RouteGuardFn>;         // name → customContexts:routeGuard  | inline fn
  guardLeave?: Named<RouteGuardFn>;    // name → same map                   | inline fn
  loader?: Named<RouteLoaderFn>;       // name → customContexts:routeLoader | inline fn (data; eager)
  outlet?: string;
  isErrorBoundary?: boolean;
  component?: RouteComponentRef;       // Fork-2 lazy view: inline thunk | bare specifier | name (opt. DI)
}
```

**Merge-not-shadow (part of the Fork-1 ruling).** `getProviderOf` is first-found-wins, so a nested
`route-view` must *merge* the resolved list with its local static parse, never let first-found replace it:

```ts
// inside RouteViewElement, building the engine's ordered route list:
const staticRoutes  = parseRouteDefinitions(this);                       // we:blocks/router/types.ts
const dynamicRoutes = InjectorRoot.getProviderOf(this, 'customContexts:routes') ?? [];
const routes = mergeRoutes(staticRoutes, dynamicRoutes);                 // Fork-3 order, below
// NOT: getProviderOf(...) ?? staticRoutes  ← would silently drop the static table on a nested view
```

### Fork 2 (proposed default) — lazy component-from-URL

```ts
// JS / runtime form — inline thunk, no name-registry, resolved on first match:
{ path: '/reports', component: () => import('./views/reports.js') }
```

```html
<!-- Serializable / DOM form — bare module-specifier string on route:component.
     route:loader stays independent and eager (data), route:component is the deferred view. -->
<template route="/reports" route:component="./views/reports.js" route:loader="reportsLoader"></template>
```

`type RouteComponentRef = (() => Promise<unknown>) | string;` — the thunk for JS, the specifier for DOM.
Named `route:component` (not `route:module`) to disambiguate from the data `route:loader` and match
Angular/Vue (`loadComponent`) naming.

**Amendment 1 — name-by-DI default, inline-fn override** (loader shown; guard/component identical):

```ts
// default: reference by NAME, resolved through the inherited customContexts:routeLoader DI map
{ path: '/users/:id', loader: 'userLoader' }

// override: pass the fn inline, used as-is (no DI lookup) — JS-runtime only; DOM form stays a string
{ path: '/users/:id', loader: ({ params }) => fetchUser(params.id) }
```

**Amendment 2 — direct code-driven route table via a settable `routes` property** (the third authoring
surface; the getter already exists at `fui:blocks/router/elements/RouteViewElement.ts:48`):

```ts
const view = document.querySelector('route-view');
// pass the full runtime route table straight to the component, in code:
view.routes = [
  { path: '/',         component: () => import('./views/home.js') },
  { path: '/users/:id', loader: ({ params }) => fetchUser(params.id),
    component: () => import('./views/user-detail.js') },
];
// merges with any DOM <template route> children under the Fork-3 order (static-first, first-match-wins).
```

### Fork 3 (proposed default) — static-first merge + shadowing diagnostic

```ts
function mergeRoutes(staticR: RouteDefinition[], dynamicR: RouteDefinition[]): RouteDefinition[] {
  // static-first concatenation; first-match-wins is preserved by the engine (we:blocks/router/types.ts:243).
  for (const d of dynamicR) {
    if (staticR.some(s => s.path === d.path)) {
      // mirror the existing `[Router] Invalid route pattern` diagnostic (we:blocks/router/types.ts:213)
      console.warn(`[Router] Dynamic route "${d.path}" is shadowed by a static route of the same pattern`);
    }
  }
  return [...staticR, ...dynamicR];   // DOM stays the canonical authoring SoT (#1685)
}
```

The override-flip (per-provider opt-in: a provider may declare prepend/override) is **out of scope here** —
carded under #1720, gated on a real disjointness/override use case. *(Awaiting Fork-3 ratification.)*

## Context

- **Unblocks:** #1720 (`blockedBy: ["1823"]`). Forks 1 + 2 are coupled — the runtime route-object shape
  carries the lazy-component ref — and are **ratified**. Fork 3 was **reframed from a fork to a configurable
  dimension delivered by config-extends-default**: `mergePrecedence` is a platform-default config field
  (default static-first + diagnostic) that a project config extends to override. No bespoke knob and nothing
  deferred — #1720 sets the field if it needs dynamic-first; it carries no knob-design task and 1823 carries
  no pre-ratify gate.
- **Lineage:** parent epic #1684; input contract #1685 (ratified) / #1721 (built); reuses the
  webinjectors context seam (`fui:plugs/webinjectors/InjectorRoot.ts`).
