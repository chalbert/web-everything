---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
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
| Fork 1 — provider shape | **(a) Reuse the injector mechanism** — new `customContexts:routes` key, runtime route-object shape carrying a component/template ref | (b) A brand-new provider contract | Med-high (the #1685-as-input branch is refuted) |
| Fork 2 — lazy component | **(a) `route:component` attr; inline `() => import()` thunk (JS) + bare specifier (DOM); no name-registry; data-loader independent/eager** | (b) `customContexts:routeModule` name-registry | Med |
| Fork 3 — merge order | **(a) Static-first concatenation, first-match-wins, + a shadowing diagnostic** | (b) dynamic-wins / explicit `priority` field | Med-high |

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

## Fork 3 — static/dynamic merge (precedence) order

**Fork-existence:** a real either/or — the matcher needs *one* ordered list, and static-wins vs dynamic-wins
vs explicit-priority are mutually-exclusive precedence rules. (b) explicit-`priority`-field is the *flawed*
branch: net-new schema surface no consumer asked for, layered onto an order-based engine that has no
specificity ranking — it compounds the order-vs-rank confusion rather than resolving it.

**Crux.** The engine is declaration-order, first-match-wins (`we:blocks/router/types.ts:243-266`); there is
no specificity tier to lean on, so precedence is a genuine call.

**Options.**
- **(a) Static-first concatenation + shadowing diagnostic** *(default)* — concatenate static routes then
  dynamic, preserve first-match-wins (smallest change; authored DOM stays the dominant SoT, aligning with
  #1685's "DOM is canonical authoring SoT"); **and** emit a `console.warn` when a dynamic pattern is shadowed
  by a static one (mirroring `[Router] Invalid route pattern`, `we:blocks/router/types.ts:213`) so silent
  data loss can't hide.
- **(b) dynamic-wins, or an explicit `priority` field** — *Rejected* for the default; dynamic-wins weakens
  the static-is-SoT invariant, and a `priority` field is unrequested schema surface.

**Skeptic:** SURVIVES-WITH-AMENDMENT → folded. The attack (static-wins forecloses runtime override; the
"disjoint sets" premise is unenforced) is partly adopted: the shadowing diagnostic is now part of the
default, and **#1720 must land a concrete disjointness-enforcement or override use case before this fork is
ratified** — if a runtime-override use case is real, the call flips to a per-provider opt-in
(default static-wins, a provider may declare prepend/override).

## Supported by default (not decisions)

- **Name-indirection for loader/guard** — unchanged; dynamic routes carry loader/guard **names** resolved
  through the existing `customContexts:routeLoader`/`routeGuard` maps.
- **#1685 as the serialization contract** — stays the wire/transport projection; this decision does not
  touch it (it only rules it out as the live engine input).

## Context

- **Unblocks:** #1720 (`blockedBy: ["1823"]`). Forks 1 + 2 are coupled — the runtime route-object shape
  carries the lazy-component ref — so they resolve together; Fork 3 carries a pre-ratify gate on #1720
  grounding its disjointness premise.
- **Lineage:** parent epic #1684; input contract #1685 (ratified) / #1721 (built); reuses the
  webinjectors context seam (`fui:plugs/webinjectors/InjectorRoot.ts`).
