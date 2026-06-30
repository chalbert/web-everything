---
kind: decision
parent: "1975"
status: active
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, directive, composition, defer, hydration]
---

# Directive proposal — defer / hydration-trigger (on idle, visible, interaction, media, timer; prefetch)

Net-new directive candidate (#1975 catalog). Defer a region's connection or hydration until a declared trigger (idle, visible via IntersectionObserver, first interaction, media query, timer), with optional prefetch. Astro client:* , Angular @defer, and Qwik converged independently on the same trigger vocabulary — the strongest cross-ecosystem signal of a missing native primitive. Pure pre-connection gate, the quintessential directive. WE has lazy proposed. Decide at the #1963 bar.

## Example (proposed authoring)

```html
<!-- defer on="visible" prefetch="idle" -->
  <template slot="placeholder"><div class="skeleton"></div></template>      <!-- stamped immediately -->
  <template slot="content"><heavy-chart data="@sales"></heavy-chart></template> <!-- inert; stamped when it scrolls into the viewport -->
<!-- /defer -->

<!-- on       = idle | visible | interaction | hover | media:(min-width:600px) | timer:5s
     visible  = the region's anchor intersects the VIEWPORT (IntersectionObserver) — Astro client:visible /
                Angular @defer (on viewport). NOT CSS visibility; it fires when the user scrolls it into view.
     prefetch = warm the content's module/data during browser idle (requestIdleCallback / Speculation Rules)
                BEFORE the trigger, so stamping on-trigger is instant -->
```

Multi-region directive (placeholder + content; optional loading/error) → **comment-anchor boundary + `<template slot>` per region**, exactly the built `resource:loader` / `switch` convention (`fui:plugs/webdirectives/multiTemplate.ts`). The directive stamps `placeholder` at once and `content` on trigger — both held in inert `<template>`s so nothing connects early. Strict form rule: **Fork B**.

- **Framework analog:** Angular `@defer (on viewport) { } @placeholder { } @loading { }`; Astro `client:visible|idle|media`; Qwik resumability.
- **Substrate:** `IntersectionObserver` (visible) · `requestIdleCallback` (idle) · `matchMedia` (media) · event listener (interaction/hover) · timer; **prefetch → Speculation Rules** (the one piece with a converging native standard).

## The gate — does it clear the #1963 5-point bar?

| Bar criterion | Verdict |
|---|---|
| 1. Ergonomics ≥ frameworks | ✅ matches the Astro `client:*` / Angular `@defer` / Qwik vocabulary one-for-one — the *converged* surface, not a web-components approximation |
| 2. Zero compromise (layout/CSS/AX) | ✅ `<template>` is inert → **zero rendered nodes** until the trigger; on fire, content stamps as **real children at the declaration site** (no wrapper). No box, no AX entry, no content-model position pre-trigger |
| 3. No-compromise solution for the case | ✅ no native one-shot primitive unifies the triggers; the directive is the clean answer |
| 4. Net-new mechanism / plug-to-direction | ✅ genuine **plug** (substrate above) — no single native primitive unifies the trigger vocab → standards-watch; only `prefetch` has a converging target (Speculation Rules) |
| 5. Authoring-surface-agnostic | ✅ `<template is="defer" on="visible">` in HTML; functional/JSX `defer({on:'visible'}, …)` equivalent |

**Gate verdict: clears all five.**

## Forks

### Fork A — name the directive `defer` or `lazy`? *(the one live call)*
The spec lists **`lazy`** but it is **proposal-only — no impl, no card** (just one `<li>` in we:project-webdirectives.njk and 📋 in the report). So nothing migrates; this is a pure **naming** call (identical capability either way).

| Axis | `lazy` | `defer` |
|---|---|---|
| Native HTML precedent | `loading="lazy"` — but *viewport-only, element attribute, resource fetch* | `<script defer>` — postpone-until-parsed |
| Framework prior art | React/Solid `lazy()`, Qwik | Angular `@defer (on …)` — exact `directive + on=<trigger>` model |
| Fit with `on=<trigger>` | "lazy on interaction" reads oddly | "defer … on visible" reads as a sentence ✓ |
| Breadth (idle·visible·interaction·media·timer) | connotes viewport/idle only — undersells | umbrella for any trigger ✓ |
| Existing WE overload | already used: trait-loading (#034), lazy routes (#1897) | only an option (`resource:loader defer=`) |

- **(a) `defer`** *(default)* — wins 4 of 5 axes; the dangling `lazy` listing is replaced, `lazy` may stay a synonym for the `on="visible"` shorthand. **Why native-first doesn't tip it to `lazy`:** `loading="lazy"` names the *narrow* viewport case; naming the *broad* directive after it would mislabel it.
- **(b) `lazy`** — honours the `loading="lazy"` precedent + existing listing, but undersells the breadth.
- **(c) two directives** (`lazy` viewport + `defer` rest) — redundant. **Rejected.**

### Fork B — directive form — *the strict selection rule (derived, not a free choice)*
Form is **derived** from region count + each region's inertness, matching what's already built. Two independent choices:

**Outer boundary:**
| Body shape | Outer form | Built example |
|---|---|---|
| 1 region, renders **live** (gate presence/count/position) | `<!-- ns:name -->live body<!-- /ns:name -->` | `if`, `for-each` |
| 1 region, must be **inert** until stamped | `<template is="ns:name">…</template>` | `portal-directive` |
| **N named regions** (states / branches / slots) | `<!-- ns:name -->` boundary + `<template slot="x">` per region | `resource:loader`, `switch` |

**Inner (inside a comment boundary):** every managed region is a `<template slot="name">` — uniformly inert, the directive stamps each (no `slot` attr = default slot). **Invariant:** inert-required content is **never** a bare live child — it is a `<template is>` body (single) or a `<template slot>` (multi). *(The original example broke exactly this — bare `<heavy-chart>` between anchors would connect immediately.)*

**Defer is N-region** (content + placeholder; optional loading/error, per Angular's `@defer/@placeholder/@loading/@error`) ⇒ **comment boundary + `<template slot>`**, like `resource:loader`. `CustomAttribute` is excluded (can't gate its own element's connection); `<template is="defer">` is the single-region form, wrong for a multi-region directive.

**Catalog-wide:** this rule governs every #1975 proposal, not just defer. **Codify it once** in we:docs/agent/block-standard.md (directive section) at ratification so #1976 / #1978–#1981 inherit one strict form-selection rule rather than re-deciding per item.

### Fork C — v1 contract scope — *ratify the full converged vocabulary*
The decision ratifies the **standard surface**; impl may land incrementally. Recommend ratifying the full vocab as the contract — all five triggers (`idle · visible · interaction/hover · media · timer`) + `prefetch` — since that *is* the cross-framework convergence the adoption case rests on. Under-speccing the contract to a subset would forfeit the convergence argument. Not a real either/or; folded into the ruling.

## Recommendation
**Adopt** — `defer` (comment-boundary + `<template slot>` form, Fork B), full converged trigger vocab + `prefetch`, **superseding the proposed `lazy`** (Fork A-a). Plug-to-direction: `prefetch` aligns to Speculation Rules; the trigger substrate is a standards-watch. At ratification: codify the directive into the webdirectives spec + block-standard directive catalog, **and codify the Fork B form-selection rule catalog-wide**; the build (impl in FUI) becomes an agent-ready child item.

## Progress
- **Status:** active — decision presented for discussion (not yet ratified)
- **Branch:** main
- **Done:** grounded against #1963 bar + form-axis + existing `lazy` proposal; set relatedReport; authored gate-check + forks
- **Next:** discuss Fork A (defer-supersedes-lazy) → red-team the default → ratify on explicit go → codify + scaffold build child
- **Notes:** first of the #1975 catalog to be decided — sets the directive-proposal ratification precedent
