---
bornAs: xwwwc7a
kind: task
parent: "1245"
status: open
relatedTo: ["3154", "1245"]
locus: frontierui
scope:
  - "fui:blocks/router/elements/RouteViewElement.ts"
  - "fui:blocks/router/behaviors/RoutePrefetchBehavior.ts"
  - "fui:blocks/__tests__/unit/router/types.test.ts"
  - "fui:blocks/__tests__/unit/router/RouteViewElement.test.ts"
dateOpened: "2026-08-17"
tags: [blocks, router, drift, frontierui, constellation, debt]
---

# FUI absorbs the four WE-only router deltas orphaned by the #3154 slice (#423/#454 stamp diagnostics, #365 entry normalization, #320/#321 viewportPresence, the matchAllRoutes vectors)

## Digest

The #3154 slice deleted WE's duplicate router runtime. The two copies were diffed first, and FUI is ahead
on almost everything — but **four things existed only WE-side** and have no FUI counterpart, so they went
out with the deletion. This item ports them, so nothing the slice removed is silently lost.

For context on the rest of that diff: FUI already carries #1897 lazy components, the #1720/#1823 runtime
route objects + `merge-precedence`, the #841/#908-A `we-*` spec tags with the `registerRouteView` /
`registerRouteOutlet` split, and the #1991/#2048 `route:guard-leave` rename that WE's copy never got.

1. **#423/#454 stamp diagnostics — the load-bearing one.** The deleted WE `RouteViewElement.#stampAllRoutes`
   carried two guards FUI has **never** had. (a) A `console.error` when a matched **non-empty**
   `<template>` clones to an **empty** fragment — the silent no-op that reads as "the route is broken".
   (b) A `try`/`catch` around the stamp `appendChild` that reports the throw **with the route path** and
   continues, so one bad route cannot take the navigation down silently. FUI's stamp site is a bare
   `stampTarget.appendChild(renderable)` with no guard on either side.

   This is not cosmetic: it is the fix for #423 (`status: resolved`) and the diagnostic half of #454. The
   trigger is documented in a spec this slice **keeps** — `we:blocks/__tests__/e2e/router-empty-clone.spec.ts`
   — a route body holding a native `<select>`, where the patched `cloneNode` threw and the view went blank
   with no caught error. Under FUI's router that throw escapes an `async` method as an unhandled rejection
   carrying no route identity. Worse, that kept e2e asserts the console is free of an `empty fragment`
   message that can no longer be emitted by anything, so half the regression guard is now vacuous.
   **Porting this restores the guard AND re-arms that assertion.**

2. **#365 entry-URL normalization** — the deleted WE `RouteViewElement` carried an `entry` observed
   attribute plus the normalization it drives: strip a trailing index page (a hard reload of a file-served
   SPA entry), leave an explicit deep link alone, and otherwise `replaceState` to the `entry` route mapped
   through `base`. The point was that a consumer sets `entry="/book"` instead of hand-rolling a
   `history.replaceState` shim before connect. FUI's `RouteViewElement` observes
   `scroll` / `base` / `transition` / `keep-alive` / `merge-precedence` — **no `entry`** — and has no
   equivalent normalization under another name. Note `entry` is **not** in the block's declared attribute
   vocabulary (`we:src/_data/blocks/router.json` lists `scroll` / `base` / `transition` / `keep-alive` /
   `name` / `route` / `route:*` / `lazy`), so porting it FUI-side alone would land an undeclared FUI-only
   attribute — decide whether it earns a WE contract surface first, or ship it as an impl affordance.

   **Its vectors die with it unless ported too.** The deleted WE `RouteViewElement` suite held the only
   `entry` coverage that has ever existed — an `entry-URL normalization (#365)` describe of three cases
   (lands on the entry route when the load-time URL resolves to no route; `replaceState`s the entry route
   through `base`; does **not** redirect when no `entry` is set, i.e. back-compatible), plus the `entry`
   getter case and `'entry'` in the `observedAttributes` assertion. FUI's 734-line suite contains the
   string `entry` **zero** times. This is purely behavioural — a `history.replaceState` on connect — so
   without those vectors it is exactly the kind of feature that regresses silently.

3. **#320/#321 viewportPresence composition** — the deleted WE `RoutePrefetchBehavior` composed the shared
   viewport-presence trigger (`createViewportPresenceObserver`) for its `visible` prefetch mode, keeping its
   own UX (one-shot prefetch on enter, a `50px` root margin) and its own no-IntersectionObserver fallback.
   FUI's copy still hand-rolls a raw `IntersectionObserver` inline — even though the shared trigger already
   exists in FUI at `fui:plugs/webbehaviors/viewportPresence.ts`, and
   `fui:plugs/webbehaviors/CustomAttributeRegistry.ts` already consumes it. A same-repo composition cleanup,
   not a port of missing code.

4. **The `matchAllRoutes` vectors — a gap in an EXISTING suite, not a missing suite.** FUI already has
   `fui:blocks/__tests__/unit/router/types.test.ts` (351 lines) covering `parseRouteDefinitions`,
   `matchRoute`, `findErrorBoundary`, `buildNavigationTarget` and `buildRouteContext` — and it is *ahead* of
   the deleted WE copy, carrying the `route:guard-leave` + back-compat-alias cases WE's never had. The one
   `describe` it lacks is **`matchAllRoutes`** (4 cases in the deleted WE suite, including the #1245
   catch-all regression *"returns only the first in-place match (not later catch-all)"* — the exact bug that
   motivated this epic). FUI's `matchAllRoutes` **implementation** is fine — it carries the `primaryFound`
   guard — so only the vectors are missing. **Extend the existing suite; do NOT author a new file over it.**

**Port-and-adapt for the runtime; most vectors are portable near-verbatim.** FUI's runtime has moved on
from the copy these came from, so deltas 1–3 must be re-expressed against FUI's current shape (its stamp
path is `async` and its element carries `merge-precedence`, neither of which the WE copy had). The **test
vectors are largely the opposite case**:

- The **`matchAllRoutes` describe ports as-is.** It contains **zero** `route:guard:leave` — its templates
  use only `route`, `route:outlet` and `route:error`, so the #1991/#2048 rename does not touch it. There is
  no import-path change to make either: FUI's suite already imports from the same relative specifier. The
  one edit is **adding `matchAllRoutes` to FUI's existing import list**, which currently omits it. That
  minimal delta is the point — the value of these four cases *is* that they are the exact #1245 catch-all
  regression, so rewriting them would throw away what makes them worth porting.
- The **`entry` vectors are two-thirds verbatim.** The `replaceState`-through-`base` case and the
  no-redirect-without-`entry` case are pure history spies and port unchanged. The first case
  (*lands on the entry route when the load-time URL resolves to no route*) does **not**: it appends the
  element, awaits a macrotask, then asserts stamped `textContent` — so it crosses FUI's now-`async` stamp
  path and needs re-expressing like deltas 1–3.

(The `route:guard:leave` spelling does appear in the deleted suite — three times, all inside the
`parseRouteDefinitions` describe that FUI **already has** and that is *not* being ported. It is not a
reason to rewrite anything that is.)

## Done when

1. **Executable** — in the `frontierui` repo, `npm run check:standards` is green with all four landed:
   `fui:blocks/router/elements/RouteViewElement.ts` restores the #423 empty-clone `console.error` plus the
   route-identified `try`/`catch` around the stamp `appendChild`, and observes `entry` with the load-time
   URL normalized into route space; `fui:blocks/router/behaviors/RoutePrefetchBehavior.ts` composes
   `createViewportPresenceObserver` instead of a hand-rolled `IntersectionObserver`; and a
   **`matchAllRoutes` `describe` is ADDED to the existing** `fui:blocks/__tests__/unit/router/types.test.ts`
   (351 lines — extend it, never overwrite it), including the catch-all first-in-place-match regression from
   #1245.
2. **Covered, not just implemented** — `fui:blocks/__tests__/unit/router/RouteViewElement.test.ts` (734
   lines — extend, never overwrite) gains the vectors, with the two halves weighted differently:

   - **#365 `entry` — a restoration, and owed.** The three normalization cases, the `entry` getter, and
     `'entry'` in the `observedAttributes` assertion all existed in the deleted WE suite and have no FUI
     counterpart. Porting them back is not new work, it is not losing work.
   - **#423 — net-new hardening, and partly negotiable.** WE shipped those diagnostics with **no** unit
     vectors at all (the deleted 551-line suite mentions neither `empty fragment` nor `failed to stamp`);
     they were e2e-covered only. So this asks FUI for coverage WE itself never wrote. Take the
     **`appendChild`-throw** vector regardless — a spy that throws is cheap and exercises the real path.
     The **empty-clone** vector is contestable: reproducing it at unit level means stubbing `cloneNode` to
     return an empty fragment, an artificial condition that in reality only arises from the webcomponents
     polyfill patch — which is precisely what Done-when 3's e2e exercises. If the unit stub proves
     artificial, **let Done-when 3 satisfy that half**; do not stall this item over a test of a mock.
3. **Re-armed** — `we:blocks/__tests__/e2e/router-empty-clone.spec.ts` passes with its `empty fragment`
   console assertion meaningful again, i.e. the message it looks for is one the shipped router can emit.
