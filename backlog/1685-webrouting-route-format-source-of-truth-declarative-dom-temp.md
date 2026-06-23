---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
preparedDate: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, route-format, constellation-placement]
---

# webrouting route-format source-of-truth — declarative-DOM templates vs a serializable route-map vs both

Pick the canonical form of an app's route table for the webrouting standard. **Recommended: (c) both, one derived** (med-high) — keep declarative-DOM `<template route>` as the HTML-first authoring source-of-truth and *derive* a serializable route-map projection for non-DOM consumers (sitemap, prerender, config tooling), built by the first consuming slice. URLPattern stays the pattern grammar and the projection is an internal schema (no protocol yet) — both forced invariants, not forks. Grounded in [/research/route-table-authoring-source-of-truth](/research/route-table-authoring-source-of-truth/).

## Axis framing

There is exactly **one** genuine fork here — *what is canonical* — plus two forced invariants the research settles. The concern decomposes along three axes:

- **Authoring source-of-truth** (the fork). Today routes are authored purely as declarative DOM: `parseRouteDefinitions()` (`we:blocks/router/types.ts:194`) runs `querySelectorAll('template[route]')` (`we:blocks/router/types.ts:198`) over `<we-route-view>`'s children, reading `route` / `route:guard` / `route:loader` / `route:outlet` / `route:error` attrs (`we:blocks/router/types.ts:204-227`). The resulting `RouteDefinition` (`we:blocks/router/types.ts:131`) holds a compiled `URLPattern` + a live `HTMLTemplateElement` — **both non-serializable** — so no consumer can read the route table without a DOM. → **Fork 1**.
- **Pattern grammar** (settled invariant). The router already compiles `new URLPattern({ pathname })` (`we:blocks/router/types.ts:211`); native-first means URLPattern *is* the grammar — webrouting invents no syntax. **Ratify**, not a fork.
- **Interchange / protocol status** (settled invariant). One conforming router exists today (`fui:blocks/router`), so the derived map is an internal WE schema + conformance vectors; a `CustomRouteMap`-style protocol is minted only on a *second* independent impl (protocol temporal rule). **Ratify**, not a fork.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — authoring source-of-truth | **(c) declarative-DOM is the authoring SoT + a *derived* serializable route-map projection for non-DOM consumers** | (a) declarative-DOM only, no data form | Med-high (~75%) |

## Fork 1 — what is the canonical authoring source-of-truth?

**Fork-existence:** a real either/or — there can be only **one** canonical authoring form (two authoring homes = drift, and it violates single-SoT), and option (b) is a positively-flawed branch (below). The choice is *what authors edit* and *whether a serializable form exists at all*.

**Crux (real-tree refs):** the route table is DOM-bound and non-serializable today — `RouteDefinition` carries `pattern: URLPattern` + `template: HTMLTemplateElement` (`we:blocks/router/types.ts:131-148`), built only by the `querySelectorAll`-driven `parseRouteDefinitions` (`we:blocks/router/types.ts:194`). The sibling consumer [#1688](/backlog/1688-webrouting-sitemap-derivation-scope-which-artifact-set-ships/) (sitemap) and build-time prerender need to read routes **without** instantiating the running app.

**Options:**

- **(a) Declarative-DOM only** — the status quo, no data form ever. Simplest, but every non-DOM consumer must independently spin a headless DOM and re-project the routes — no shared contract. *Rejected:* blocks #1688 / prerender from a stable shared form and duplicates the projection into each consumer.
- **(b) Serializable data route-map as the authoring SoT** — authors edit a JSON/data route table; templates become content it points at. Most tooling-friendly, but splits authoring across *data + markup* (the route's content still lives in a template), giving two authoring homes. *Rejected:* un-HTML-first, against the WE author-in-the-standard's-own-form rule; and the fork-existence search finds a consumer for a derived data form but **none** for a data *authoring* form (TanStack/React-Router/Angular/Vue use code arrays only because they lack a native declarative form — WE has one).
- **(c) Both, one derived** — `<template route>` stays the canonical authoring SoT; webrouting defines a serializable **route-map projection** of `RouteDefinition` (`path`, `guard`, `guardLeave`, `loader`, `outlet`, `isErrorBoundary`; dropping non-serializable `pattern` + `template`), built by the first consuming slice that needs it. Mirrors TanStack (file→generated tree) and Next (files→manifest). Single SoT (the map is generated, never hand-authored → no drift); HTML-first authoring preserved; non-DOM consumers unblocked.

**Recommended default: (c) both, one derived.** Keeps HTML-first authoring, gives the non-DOM consumers a fixed shared contract, and stays single-SoT because the map is *derived*, not a second authored form. The derived artifact is carved into the consuming slice (sitemap/prerender), not built speculatively (build-only-when-a-consumer-exists).

**Sub-decision (derivation direction):** **DOM→map** (the DOM is the authoring SoT in (c)), *not* map→stamped-DOM.

**Bounds (folded in from the skeptic pass):** derivation is DOM→map and **may still require a headless DOM** (linkedom / happy-dom) to run the existing `parseRouteDefinitions` — webrouting adds *no* DOM-free parser; (c) is still distinct from (a) because it forbids (b) and **fixes the projection shape as the cross-consumer contract** even with the build deferred. The map enumerates **route templates, not concrete URLs** — parametric-URL enumeration (`/users/:id`) needs a value source, which is [#1688](/backlog/1688-webrouting-sitemap-derivation-scope-which-artifact-set-ships/)'s scope, not this decision's. The projection covers **statically-authored routes only** — runtime/lazy-added routes absent from the static DOM are excluded by construction.

**Skeptic:** SURVIVES-WITH-AMENDMENT — an adversarial pass (2026-06-23) confirmed (c) over (a)/(b) but corrected three over-claims, now baked into *Bounds* above: (1) derivation is not DOM-free; (2) the map yields route templates, not URLs (parametric enumeration → #1688); (3) statically-authored routes only. Attack 1 (false/premature fork) failed — (c) decides something today: it forbids (b) and fixes the projection contract. Attack 3 (reject of (b) is dogma) failed — (b)'s rejection is principled, no consumer needs a data *authoring* form.

---

## Context

- **Settled invariants (ratify, not forks):** URLPattern is the committed pattern grammar (`we:blocks/router/types.ts:211`); the derived map is an internal WE schema + conformance vectors until a second independent router conforms (protocol temporal rule).
- **Foundational ordering:** this fork is read by the siblings — [#1686](/backlog/1686-webrouting-url-as-state-seam-one-shared-serialize-sync-provi/) (URL-as-state) and [#1688](/backlog/1688-webrouting-sitemap-derivation-scope-which-artifact-set-ships/) (sitemap) both consume whatever form is canonical, so prefer settling #1685 first.
- **Graduation:** on ratification this carves the route-format build slices under [#1684](/backlog/1684-scaffold-the-webrouting-standard-route-format-profile-url-as/) via `/slice 1684` — the route-map projection schema + conformance vectors, and the derived-map builder folded into the first consuming slice.
- **Research:** [/research/route-table-authoring-source-of-truth](/research/route-table-authoring-source-of-truth/) — full prior-art survey (TanStack, Next, React Router, Angular, Vue Router) + the options/prior-art tables.
