# Directive catalog — brainstorm of every directive that is neither a behavior nor a component

**Spawned from** [#1963](../backlog/1963-composition-rubric-re-judged-to-framework-parity-strict-per-.md) (composition rubric)
· brainstorm · 2026-06-29 · home item: see the directive-catalog epic.

**The directive test (the filter).** A *directive* is a markup-level construct that operates on a **region** (a
comment-anchor-bounded span) or the **tree-shape / position** — controlling **whether · how-many · where · when ·
in-what-form** content exists or connects. It is **not** a *behavior* (`CustomAttribute` — decorates a *connected*
element) and **not** a *component/block* (a styled, named, instantiable thing). The decisive trait: a directive
acts **before / around** element connection, or on **structure**, where a behavior (which attaches *after* its
element connects) cannot — it can't gate *whether* an element connects or *how many times*.

**The honest line — tree-shape ↔ computation.** Directives stay legitimate while they govern *tree-shape* (existence,
iteration, position, timing, projection). They drift into **app-logic-in-markup** when they start *computing* (sort,
filter, paginate, format, arithmetic). Each entry below is tagged: 🟢 tree-shape (clean) · 🟡 borderline · 🔴
computation-leaning (the value is real but it risks putting logic in markup — gate hard).

**WE status:** ✅ built · 📋 proposed in the [webdirectives spec](../src/_includes/project-webdirectives.njk) · ⬚ net-new.

## The form axis — comment vs template vs structural-annotation (the authoring vehicle)

A directive's *form* is not free choice — it follows from its relationship to its body:

- **Ⓒ Comment-anchor** (`<!-- ns:name -->…<!-- /ns:name -->`, `CustomComment`) — the bounded content is **live, renders
  as-is**, and the directive controls its *presence / count / position*. → `ViewIf`, `ForEach`, `ViewSwitch`, an
  error-boundary's *guarded* region.
- **Ⓣ Template element** (`<template is="ns:name">`, `CustomTemplateDirective`) — the content must be **inert until
  stamped** (deferred, branch-selected, defined-for-reuse, projected, or held-then-transformed); `<template>`'s native
  inertness *is* the mechanism. → `portal`, **defer**, **async branches**, **snippet:define**, fallbacks, **sanitize**.
- **Ⓐ Structural-annotation** (a config element — `<script type="injector">` — or an attribute) — **no body of its own**;
  it *adds to the structure without modifying the DOM* (context, scope, feature-flag, metadata). → provider/inject,
  scope, ambient-context. *(The context-provider case: "does not modify the DOM but adds something to the structure.")*

**Decisive test:** does the body render as-is (**Ⓒ**), stay inert until a trigger/selection (**Ⓣ**), or is there no body —
just metadata on a subtree (**Ⓐ**)? Each candidate below carries its form tag.

---

## 1. Control-flow (conditional existence) 🟢
| Capability | What | WE |
|---|---|---|
| **if / else / else-if** | render a region only when truthy; node added/removed | ✅ `ViewIf` |
| **switch / case / default / match** | pick exactly one branch by value | ✅ `ViewSwitch` |
| **unless / inverted** | render when falsy | ⬚ (negation exists via `!` in ViewIf) |
| **show / hide** | toggle *visibility* (keeps node) — **behavior, not directive** | ✅ `ViewShow` (a `CustomAttribute`) |
Universal across every framework + template language. `if` and `for(keyed)` are the strongest native-gap signals.

## 2. Iteration / lists 🟢 (🟡 transforms)
| Capability | What | WE |
|---|---|---|
| **for / each (+ alias, index)** | repeat a region per item | ✅ `ForEach` |
| **keyed iteration (`track`)** | stable key → reuse/reorder, not rebuild | ✅ key parsed; 📋 diffing (Phase 2, #1971) |
| **index iteration** | positional identity (Solid `<Index>`) | ⬚ |
| **empty / else-of-loop** | region when collection is empty | ⬚ |
| **range** | iterate a numeric range, no backing array | ⬚ |
| **group-by / sort / filter / paginate** 🔴 | declarative list *transforms* | ⬚ — **app-logic line**; expose as data-view config, not free expression |

## 3. Async / timing / suspense 🟢
| Capability | What | WE |
|---|---|---|
| **await / then / catch** | render pending→resolved→error of a promise | 📋 `async:boundary` |
| **suspense / fallback** | coordinate fallback while descendants resolve | 📋 |
| **defer / lazy (on idle\|visible\|interaction\|media\|timer + prefetch)** | defer connection until a trigger | 📋 `lazy` (partial) — **Astro+Angular+Qwik converged on the same vocabulary** |
| **placeholder / loading** | pre-trigger vs in-flight content | ⬚ |
| **async stream append/replace** | render async-iterable values as they arrive | ⬚ (Lit `asyncAppend`/`asyncReplace`) |

## 4. Data / binding / interpolation 🟡
| Capability | What | WE |
|---|---|---|
| **text interpolation `${}`** | reactive text into the tree | ✅ `CustomTextNode` |
| **attribute / property bind** | bind expr → attr/prop | 🟡 (resolveBinding) |
| **two-way model** | sync form/value both ways | ⬚ |
| **bind this / ref** | capture the node/instance | ⬚ |
| **raw / trusted HTML** | inject a string as parsed HTML | 📋 `trusted:html` |
| **set text (escaped)** | inject a string as escaped text | ⬚ |
| **conditional attribute (ifDefined)** | drop attr when nullish | ⬚ |
| **class / style binding** | toggle classes/styles from a map | 🟡 (mostly CSS/behavior turf) |
| **local const / let (`@let`/`{@const}`)** | declare a scoped value in markup | ⬚ |
| **once / memo** 🟡 | render once / skip unless deps change | ⬚ |
| **pre / raw / cloak** | suppress template syntax; hide uncompiled markup | ⬚ |

## 5. Projection / teleport / slot 🟢
| Capability | What | WE |
|---|---|---|
| **slot / named / scoped slot** | projection holes (+ data back to consumer) | ✅ native `<slot>` |
| **snippet / render (parameterized reusable block)** | define a markup block once, render by ref with args | ⬚ — maps onto Template Instantiation |
| **template outlet** | render a referenced template with context | 🟡 (`<template>` + directive) |
| **teleport / portal** | render to a different DOM location, keep logical parent | ✅ `portal-directive` |
| **fragment / grouping** | multi-root, no wrapper | ✅ (transient / comment) |
| **dynamic component / element (`:is`)** | render a tag/component chosen at runtime | ⬚ |

## 6. Context / scope / DI 🟢
| Capability | What | WE |
|---|---|---|
| **provide / inject** | pass data down a subtree | ✅ injector; → Context Protocol (#1968) |
| **with / scope** | open a region scoped to an object | 🟡 (Handlebars `#with`) |
| **scoped registry** | scoped custom-element resolution | ✅ `<scope>` (blocked #901) |

## 7. Gating — feature / auth / env 🟢
| Capability | What | WE |
|---|---|---|
| **if-supported / if-feature** | render only if a platform API exists | ⬚ |
| **if-media / if-container** | viewport/container-gated *existence* (not just CSS hide) | ⬚ |
| **if-auth / if-role / if-permission** | authorization-gated existence | ⬚ (build on `if`) |
| **if-flag / experiment / ab-test** | feature-flag / A-B variant region | ⬚ |
| **no-ssr / client-only / server-only / dev-only / prod-only** | render-target / env gate | ⬚ (Astro `client:only`/`server:defer`) |

## 8. Hydration / loading strategy 🟢
The Astro `client:*` family — **load / idle / visible / media / interaction / only**, + **prefetch**, + **inline**.
Strong cross-ecosystem convergence (Astro + Angular `@defer` + Qwik). WE: ⬚ (overlaps `lazy` 📋, §3 defer).

## 9. Error boundary 🟢
| Capability | What | WE |
|---|---|---|
| **error-boundary / catch** | catch render errors in a subtree → fallback region | ⬚ — no platform analog; Solid/React/Vue/Svelte5/Angular all ship it |

## 10. Animation / transition (region enter/leave) 🟢
| Capability | What | WE |
|---|---|---|
| **transition (enter/leave)** | animate a region as it enters/leaves | ⬚ |
| **list transition (FLIP)** | animate enter/leave/move across a keyed list | ⬚ (pairs with `moveBefore` #1969) |
| **view-transition (cross-state/doc)** | morph elements across states/navigations | ⬚ (native View Transitions API as substrate) |
| **keep-alive / cache** | preserve state when toggled out | ⬚ (Lit `cache()`) |

## 11. i18n / format 🔴 (presentation, but computation-adjacent)
| Capability | What | WE |
|---|---|---|
| **translate / i18n** | mark a region for message extraction + translation | ⬚ |
| **format / pipe / filter** 🔴 | transform a value for display (date/number/currency) | ⬚ — **line: a closed format vocab is fine; arbitrary pipes = app-logic** |
| **pluralize / select (ICU)** | choose message variant by count/category | ⬚ |

## 12. Macro / include / DRY 🟢 (🟡 inheritance)
| Capability | What | WE |
|---|---|---|
| **include / partial** | inline another template/region (the missing native `<include>`) | ⬚ |
| **macro / reusable block** | parameterized reusable markup function | ⬚ (= snippet, §5) |
| **import** | import macros/templates from another file | ⬚ |
| **block / extends / yield** 🟡 | template inheritance: overridable named regions | ⬚ — generalizes `<slot name>` to multi-level |

## 13. Virtualization / performance 🟢
| Capability | What | WE |
|---|---|---|
| **virtual / windowed list** | render only the visible window of a large list | ⬚ — pairs with `content-visibility`; reimplemented everywhere |
| **guard / memo** | skip re-render unless deps change | ⬚ |
| **keyed re-mount (`{#key}`)** | discard+rebuild a subtree when an identity changes | ⬚ |
| **cache** | cache rendered DOM for cheap show/hide | ⬚ |
| **debug** | log/breakpoint reactive state at a markup point | ⬚ (Svelte `{@debug}`) |

## 14. Resource / data (async data + mutation state machines) 🟡
| Capability | What | WE |
|---|---|---|
| **resource:loader** | data-fetch region with loading/success/empty/error states | 📋 |
| **resource:action** | mutation lifecycle (idle/pending/done) + optimistic update | 📋 |
| 🟡 line: the *state-machine shape* is tree-shape; the *fetch/mutation logic* must be injected, not authored in markup. |

## 15. Content security 🟢 (high-value, novel)
| Capability | What | WE |
|---|---|---|
| **trusted:html** | enforce Trusted Types on a content zone | 📋 |
| **sanitize:content** | apply sanitization (Sanitizer API / DOMPurify) to a user-content zone | 📋 |
A genuinely directive-shaped, novel family: a *region-level content policy*. Strong native-gap (Sanitizer API is the substrate). |

## 16. Web-standards substrates (what directives compile to)
`<template>` · `<slot>` / Declarative Shadow DOM · **DOM Parts** (`ChildNodePart`/`NodePart`/`AttributePart`,
declarative `{{}}`) · **Template Instantiation** (`createInstance` + pluggable `TemplateProcessor` — the native
hook for `if`/`for` semantics) · `hidden=until-found` · View Transitions · `content-visibility`/`contain`
(virtualization primitive) · Speculation Rules (prefetch/prerender) · custom elements (`define`/`is=`).

---

## WE's current directive surface
**Built** (✅): `ForEach`, `ViewIf`, `ViewSwitch`, `portal-directive` + `PortalOutlet`; bases `CustomComment`,
`CustomCommentRegistry`, `CustomCommentParser`, `CustomTemplateDirective`; `CustomTextNode` (interpolation);
`multiTemplate` (multi-slot). **Proposed in the webdirectives spec** (📋): `lazy`, `resource:loader`,
`resource:action`, `async:boundary`, `trusted:html`, `sanitize:content`. Existing taxonomy: simple (template) ·
complex (comment) · security.

## Candidate shortlist → proposals (strongest net-new, cleanest cross-framework convergence + native gap)
1. **Async region** — `await`/`then`/`catch` + suspense/fallback (extends 📋`async:boundary`). 🟢
2. **Defer / hydration-trigger** — `on idle|visible|interaction|media|timer` + prefetch (Astro/Angular/Qwik convergence). 🟢
3. **Error-boundary** — catch render error in a subtree → fallback. 🟢
4. **Virtualized iteration** — windowed list over a `ChildNodePart` range, `content-visibility`-backed. 🟢
5. **Render-control** — `memo`/`guard` (skip unless deps change) + `keyed` (forced re-mount). 🟢
6. **Snippet + render** — named parameterized reusable markup block (→ Template Instantiation). 🟢
7. **Native include + template-inheritance** — `<include>` partial + block/extends/yield overridable regions. 🟢/🟡
8. **Scoped local-const** — `@let`/`{@const}` derived value in markup. 🟡
9. **Region transition** — enter/leave + FLIP + view-transition, region-scoped (pairs `moveBefore`). 🟢
10. **Content-security** — `trusted:html` + `sanitize:content` zones (Sanitizer API). 🟢
11. **Resource / data** — `resource:loader` + `resource:action` state machines (logic injected, not authored). 🟡
12. **Feature/env gate** — `if-supported` / `client-only` / `no-ssr` existence gates. 🟢

**The standing rule for every candidate (per #1963):** each must clear the 5-point bar, be authored to its
standards-track substrate (DOM Parts / Template Instantiation / Sanitizer API / View Transitions — *plug-to-direction*,
deprecation-ready), and stay on the 🟢 tree-shape side of the line — where it leans 🔴 (sort/filter/format/arbitrary
expression), the *shape* is the directive but the *computation* is injected, never authored in markup.
