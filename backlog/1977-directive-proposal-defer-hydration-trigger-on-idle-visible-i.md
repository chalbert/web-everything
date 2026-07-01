---
kind: decision
parent: "1975"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, directive, composition, defer, hydration]
---

# Directive proposal — defer / hydration-trigger (on idle, visible, interaction, media, timer; prefetch)

**RATIFIED 2026-07-01 — name = `defer`.** Fork 1 resolved: the directive is minted as **`defer`**
(superseding the proposed `lazy`, which may survive as a synonym for the `on="visible"` shorthand). Form =
the **`<template type="defer">` wrapper** (pure multi-region inert, per #1976 parity); contract scope = the
full converged trigger vocab + `prefetch`. Codified into the webdirectives spec
([we:project-webdirectives.njk](../src/_includes/project-webdirectives.njk) — complex-directive list + SSR
row); FUI build spun out as the agent-ready child (see Progress). Original prepared framing preserved
below.

**Prepared — one live fork: the name.** Net-new directive candidate from the #1975 catalog: defer a
region's connection/hydration until a declared trigger (`on = idle | visible | interaction | hover |
media:(…) | timer:5s`), with optional `prefetch`. It clears the [#1963 framework-parity
bar](../docs/agent/block-standard.md#composition-rubric) (gate table in `## Context`). What looked like
three forks collapses on classification to **exactly one genuine either/or — the directive's name
(`defer` vs `lazy`)**; the *form* is settled by #1983 **as applied by the #1976 sibling precedent** — a
typed **`<template type="defer">` wrapper** hosting nested inert `<template slot="…">` branches, stamped
one at a time by trigger state — and the *contract scope* is a forced ratify, not a choice.

## Grounding digest

No design exists yet — the spec lists **`lazy`** as *proposal-only* (one `<li>`,
[we:src/_includes/project-webdirectives.njk:341-342](../src/_includes/project-webdirectives.njk#L341-L342)
"Defer instantiation until triggered"; SSR row
[:463-467](../src/_includes/project-webdirectives.njk#L463-L467) "client-only, server emits nothing") —
no impl, no card. The single fork below is grounded in the catalog prior-art survey published as the
[`/research/directive-catalog-brainstorm`](/research/directive-catalog-brainstorm/) topic (§3, defer/lazy
row) and attacked by a refute-only skeptic sub-agent; the session report is linked via `relatedReport`.
The recommended default is in **bold**. **Two things are *not* forks and must not be re-litigated at the
call:** (1) the authoring **form** is inherited from the ratified [#1983 directive-form
standard](../docs/agent/block-standard.md#directive-form) **as applied by #1976** — the typed
**`<template type="defer">` wrapper** form (see the Form axis) — and (2) the **full converged trigger
vocabulary** is a forced contract ratify.

## Axis framing

The concern decomposes into three orthogonal axes; only the first is a live decision:

- **Name (LIVE fork).** Which keyword the directive is minted under — `defer` or `lazy` — over the dangling
  `lazy` listing at
  [we:project-webdirectives.njk:341-342](../src/_includes/project-webdirectives.njk#L341-L342). Pure naming;
  identical capability either way. The directive's *namespace/separator spelling* (`ns:name` colon form for
  comment directives) is **not** this axis — that is settled by the [#1987 naming
  convention](../docs/agent/platform-decisions.md#attribute-name-colon-namespacing) (resolved). This fork
  picks the **keyword** only.
- **Form (SETTLED — not a fork; template-wrapper per #1976).** Defer is a **pure multi-region inert** case,
  not "mixed": its `placeholder` is not live-DOM but an **inert branch stamped by trigger state** — exactly
  as #1976 (async region) reclassified its first-shown `pending` branch. So the form is the ruled
  multi-region-inert vehicle: **one outer `<template type="defer">` hosting nested inert
  `<template slot="placeholder|content">`s**, stamped one at a time (placeholder immediately, content on
  trigger). This follows the [#1976 async
  precedent](1976-directive-proposal-async-region-await-then-catch-suspense-fa.md) directly and the [#1983
  directive-form standard](../docs/agent/block-standard.md#directive-form) rule-2 *inert* row; registration
  is [#1986](../docs/agent/block-standard.md#directive-registration-mechanism)'s `CustomTemplateType`
  (never `is=`, never `CustomComment`). *This corrects the prepared draft, which mis-classified defer as
  **mixed** (comment boundary + live placeholder); the sibling precedent treats the placeholder as a
  stamped inert slot, so the whole region is one typed-template wrapper.*
- **Contract scope (FORCED ratify — not a fork).** Ratify the **full** cross-framework vocabulary as the
  standard surface (all five triggers + `prefetch`); under-speccing to a subset would forfeit the very
  convergence argument the adoption case rests on. Impl may still land incrementally. Not an either/or.

## Recommended path at a glance

| Fork / axis | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 — name** | **`defer`** (supersede the proposed `lazy`; `lazy` may remain a synonym for the `on="visible"` shorthand) | `lazy` (honours `loading="lazy"` + the existing listing) | **med-high** — the one real call; native-first tension is why it isn't "high" |
| Form (Ⓣ template-wrapper) | **Settled — `<template type="defer">` wrapper + nested inert `<template slot>`s** (per #1976 parity) | — (inherited, not a call) | n/a — inherited |
| Contract scope | **Full vocab** — 5 triggers + `prefetch` | subset | high — forced by the convergence argument |

## Fork 1 — name the directive `defer` or `lazy`?

*Why it's a fork (case b, real either/or):* the two names are **mutually-exclusive canonical spellings for
one directive** — you mint under exactly one keyword, and native-first (which points at `loading="lazy"`)
and breadth/precedent (which point at `defer`) pull in opposite directions, so it is a genuine judgment
call, not a forced invariant. (Two directives — one per name — is the incoherent branch, rejected as (c).)

*Crux:* the spec's `lazy` is proposal-only
([we:project-webdirectives.njk:341-342](../src/_includes/project-webdirectives.njk#L341-L342)) — nothing
migrates, so this is a clean pick with no rename cost. The axes:

| Axis | `lazy` | `defer` |
|---|---|---|
| Native HTML precedent | `loading="lazy"` — but *viewport-only, element attribute, resource fetch* | `<script defer>` — *postpone-until-later* (the is-a for a connection gate) |
| Framework prior art (the **name**) | React/Solid `lazy()` (a JS API, not a directive) | **Angular `@defer (on …)`** — the exact `directive + on=<trigger>` model |
| Fit with `on=<trigger>` | "lazy on interaction" reads oddly | "defer … on visible" reads as a sentence ✓ |
| Breadth (idle·visible·interaction·media·timer) | connotes viewport/idle only — undersells | umbrella for any trigger ✓ |
| Existing WE overload | already used: trait-loading (#034), lazy routes (#1897) | only an option value today (`resource:loader defer=`) — no directive collision |

- **(a) `defer`** *(default)* — wins native-first (the `<script defer>` "postpone" is-a fits a broad
  connection gate; `loading="lazy"` names only the *narrow* viewport-fetch case, so naming the whole
  directive after it would mislabel it), carries the one clean literal-name precedent (**Angular `@defer
  (on …)`**), reads naturally with `on=`, and is the lower-overload keyword. The dangling `lazy` listing is
  superseded; `lazy` may survive as a synonym for the `on="visible"` shorthand.
- **(b) `lazy`** — honours the `loading="lazy"` precedent and the existing spec listing, but undersells the
  trigger breadth and stacks onto two existing `lazy` uses (#034, #1897).
- **(c) two directives** (`lazy` viewport + `defer` rest) — redundant; one directive covers all triggers.
  **Rejected.**

`Skeptic:` SURVIVES-WITH-AMENDMENT (refute-only sub-agent, four axes). **Native-first:** attack fails —
`loading="lazy"` is a narrow viewport/resource-fetch *value*, not a multi-trigger connection gate;
`<script defer>`'s "postpone" is the correct is-a, so native-first backs `defer`. **Precedent honesty
(amendment applied):** the "Astro + Angular + Qwik converged" claim is overstated *for the name* — Astro
uses `client:*`, Qwik has no keyword — **only Angular** literally backs `defer` + the `on=<trigger>` model;
the tri-framework convergence is the *trigger vocabulary* (Fork's contract scope), not the name. Framing
narrowed accordingly (cite Angular for the name; convergence for the vocab). **Overload:** attack fails —
`defer` collides with nothing (only an option value in a different namespace); `lazy` is the worse
ambiguity. **Third-name check:** `hydrate` (too impl-specific — presumes SSR), `client:` (Astro-branded,
not native-shaped), `when` (collides with `if`) — none beats `defer`. Verdict: the default holds; only the
supporting citation was corrected.

## Context

Below the divider: the forced/settled axes, the gate check, and the proposed authoring — none of it a call
the decider makes, all of it what a `go` on Fork 1 ratifies.

### Proposed authoring (template-wrapper form, per #1976 / #1983 inert row)

```html
<template type="defer" on="visible" prefetch="idle">
  <template slot="placeholder"><div class="skeleton"></div></template>  <!-- stamped immediately -->
  <template slot="content"><heavy-chart data="@sales"></heavy-chart></template>  <!-- stamped on trigger -->
</template>

<!-- on       = idle | visible | interaction | hover | media:(min-width:600px) | timer:5s
     visible  = the region's anchor intersects the VIEWPORT (IntersectionObserver) — Astro client:visible /
                Angular @defer (on viewport). NOT CSS visibility; fires when scrolled into view.
     prefetch = warm the content's module/data during browser idle (requestIdleCallback / Speculation Rules)
                BEFORE the trigger, so on-trigger stamping is instant -->
```

The outer `<template type="defer">` is the [#1983 *inert* multi-region
form](../docs/agent/block-standard.md#directive-form) (`type=` is the "is-a" discriminator), matching how
[#1976 async](1976-directive-proposal-async-region-await-then-catch-suspense-fa.md) hosts its
`pending|then|catch` branches as nested inert `<template slot="…">`s stamped one at a time — the same
built multi-template machinery (`switch` / `resource:loader`,
[we:project-webdirectives.njk:140-153](../src/_includes/project-webdirectives.njk#L140-L153),
registration [:258](../src/_includes/project-webdirectives.njk#L258); shared plumbing in
fui:plugs/webdirectives/multiTemplate.ts). The `type`-**value** spelling (`defer` vs a prefixed form) is
[#1987](../docs/agent/platform-decisions.md#attribute-name-colon-namespacing)'s question, not this item's.
Optional `loading` / `error` auxiliary regions add further nested inert `<template slot>`s (per Angular
`@defer/@placeholder/@loading/@error`). Registration is `CustomTemplateType`
([#1986](../docs/agent/block-standard.md#directive-registration-mechanism)); `CustomAttribute` is excluded
— it can't gate its own element's connection.

### The gate — clears the #1963 5-point bar

| Bar criterion | Verdict |
|---|---|
| 1. Ergonomics ≥ frameworks | ✅ matches the Astro `client:*` / Angular `@defer` trigger vocabulary one-for-one — the *converged* surface |
| 2. Zero compromise (layout/CSS/AX) | ✅ each branch is an inert `<template slot>` → only the active branch's nodes render (placeholder pre-trigger, content post-trigger); the `<template type="defer">` wrapper is itself inert (renders nothing), branches stamp as real children at the declaration site — no premature AX entry for the deferred content |
| 3. No-compromise solution | ✅ no native one-shot primitive unifies the triggers; the directive is the clean answer |
| 4. Net-new mechanism / plug-to-direction | ✅ genuine **plug** — no single native primitive unifies the trigger vocab (→ standards-watch); only `prefetch` has a converging target (Speculation Rules) |
| 5. Authoring-surface-agnostic | ✅ HTML typed-`<template>` form; functional/JSX `defer({on:'visible'}, …)` equivalent |

**Gate verdict: clears all five.**

- **Framework analog:** Angular `@defer (on viewport) { } @placeholder { } @loading { }`; Astro
  `client:visible|idle|media`; Qwik resumability.
- **Substrate:** `IntersectionObserver` (visible) · `requestIdleCallback` (idle) · `matchMedia` (media) ·
  event listener (interaction/hover) · timer; **prefetch → Speculation Rules** (the one piece with a
  converging native standard).

### On ratification

Codify `defer` into the webdirectives spec + block-standard directive catalog with the full converged
trigger vocab + `prefetch`, in the **`<template type="defer">` wrapper form** (per #1976 parity),
**superseding the proposed `lazy`**. The catalog-wide form-selection rule is **already done** — [#1983
directive-form standard](../docs/agent/block-standard.md#directive-form) settled it on 2026-06-30 and names
this item as one of its appliers; defer takes the *inert* multi-region row, matching #1976. The build
(impl in FUI) becomes an agent-ready child item; `prefetch` aligns to
Speculation Rules, the trigger substrate is a standards-watch. Naming-only ruling ⇒ likely
`codifiedIn: one-off` at resolve (or a short webdirectives naming note) — no broad new statute.

## Progress
- **Status:** resolved 2026-07-01 — Fork 1 ratified (`defer`); form aligned to #1976; codified + child spun out
- **Done:** classified all three axes; **corrected the form axis (2026-07-01) — defer is pure multi-region
  *inert* (`<template type="defer">` wrapper + nested inert `<template slot>`s), NOT mixed/comment-boundary,
  per #1976 async parity** (placeholder is a stamped inert branch, not live-DOM) — user-directed align to
  #1976; grounded refs against the current tree; ran the prep skeptic on the `defer` default
  (SURVIVES-WITH-AMENDMENT)
- **Next:** none — done. FUI build is child **#2076** (blocked-by #1977, now unblocked on resolve)
- **Notes:** the prepared draft mis-classified defer as *mixed* (comment boundary + live placeholder); the
  #1976 sibling precedent treats the first-shown branch as a stamped inert slot, collapsing defer to one
  typed-template wrapper. #1983/#1986/#1987 landed the *form / registration / spelling* precedents; what
  remains here is purely the keyword pick
