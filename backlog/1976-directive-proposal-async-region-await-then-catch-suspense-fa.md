---
kind: decision
parent: "1975"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: "#2075 — async region directive build child (form per #1983; ruling recorded in item)"
codifiedIn: one-off
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, composition, directive, async, suspense, validation-gate]
---

# Directive proposal — async region (await / then / catch + suspense fallback)

**Prepared (validation gate).** A go/no-go on **admitting** a net-new directive at the
[#1963 framework-parity bar](../docs/agent/block-standard.md#composition-rubric) — not a multi-branch fork (the
form is settled catalog-wide by [#1983](1983-directive-form-standard-comment-vs-template-form-reconcile-t.md),
which this card *applies* rather than re-deciding — see *Form* below). A region that renders the **pending → resolved → error** branches of a promise,
plus a suspense-style fallback while descendants resolve. Surveyed across the field in the catalog report
([/research/directive-catalog-brainstorm](/research/directive-catalog-brainstorm/) §3); the candidate sits in
the #1975 directive catalog as 🟢 tree-shape-clean. **Recommendation: GO.**

## Grounding digest

WE already proposes `async:boundary` in the webdirectives spec as a *Complex (comment-wrapper)* directive
([we:src/_includes/project-webdirectives.njk:367-368](../src/_includes/project-webdirectives.njk#L367-L368) —
"Suspense-like with fallback template"). This card **promotes** that single-fallback stub to the full
**three-branch** shape every framework ships: Svelte `{#await}/{:then}/{:catch}`, Lit `until()`, Solid
`<Suspense>` + resource (catalog report §3). The directive owns only the three-branch **shape**; the promise is
**injected** (a binding/injector value), so the fetch logic never lives in markup — that is what keeps it on the
tree-shape side of the [tree-shape↔computation line](/research/directive-catalog-brainstorm/) rather than
drifting into app-logic. Distinct from the `resource:loader` directive already in the spec
([:355](../src/_includes/project-webdirectives.njk#L355)): `resource:loader` owns a *fetch+state-machine* (a
named loader), whereas `async:await` is the lower-level *one-promise* primitive that the resource directive can
build on — no statute overlap (skeptic pass-2).

## Axis framing

The only live question is **admit at the bar — go / no / not-yet**. The two sub-questions that could have been
forks are both already disposed:

- **Form is settled by #1983 — Fork 2 (a), not re-decided here.** All three branches (pending / then / catch) are
  **inert, data-gated** templates, so async is a pure *multi-region inert* case → the ruled multi-region form:
  one outer `<template type="async">` hosting nested inert `<template slot="pending|then|catch">`s, stamped **one
  at a time** by promise state. The `type=` attribute is the "is-a" discriminator ([#1983 ruling](1983-directive-form-standard-comment-vs-template-form-reconcile-t.md);
  codified in the [Directive form standard](../docs/agent/block-standard.md#directive-form)). This
  **supersedes** this card's original comment-boundary sketch (`<!-- async:await -->` + sibling `<template slot>`),
  which is #1983's **rejected** Fork 2 (b). The `type`-value spelling (`async` vs a prefixed form) and any binding
  syntax are under [#1987](1987-attribute-naming-convention-review-colon-namespacing-view-if.md), not this card.
- **Substrate is named — DOM Parts `ChildNodePart`.** The standards-track migration target the bar (criterion 4)
  requires; the directive is authored to deprecate toward it when DOM Parts ships.

## Recommended path at a glance

| Question | Verdict | Why |
|---|---|---|
| Admit at the #1963 bar? | **GO** — promote the `async:boundary` stub to the full three-branch async region (pending / then / catch) | Universal framework feature, tree-shape-clean (promise injected), real native substrate (DOM Parts), no statute overlap with `resource:loader`. |
| Form? | **Settled by #1983 — Fork 2 (a): `<template type="async">` + nested inert `<template slot>`** | All three branches inert/data-gated → multi-region inert; the `type=` "is-a" form. Not re-decided here; supersedes this card's old comment-boundary sketch (#1983's rejected Fork 2 (b)). |
| Pending-state timing? | **Amendment (folded): directive owns a `min-pending` / delay attribute; the fetch stays injected** | Skeptic pass-1: a bare injected promise can't express debounce / min-display, which every analog ships — ergonomics (criterion 1) would fall *below* frameworks. Pin the timing knob to the directive's attribute surface, not the binding. |

## Ruling — ratified 2026-07-01

Ratified by the decision-owner. **GO** — admit the async region at the [#1963 framework-parity bar](../docs/agent/block-standard.md#composition-rubric).

- **Admission:** the three-branch async region (pending → resolved → error) is admitted as a net-new
  `webdirectives` directive. Promotes the single-fallback `async:boundary` spec stub to the full shape every
  framework ships.
- **Form:** applies [#1983](1983-directive-form-standard-comment-vs-template-form-reconcile-t.md) Fork 2 (a) —
  outer `<template type="async">` hosting nested inert `<template slot="pending|then|catch">`s (all branches
  data-gated → multi-region inert). Not re-decided here.
- **`async:boundary` disposition:** **folded in** — the stub is a single-fallback "suspense-like" entry with no
  distinct cross-region-coordination job, so the three-branch form subsumes it. No alias retained; the spec stub
  is superseded.
- **Amendment (from prep skeptic, retained):** the directive owns a `min-pending` / delay attribute for
  pending-state timing (debounce / min-display); the promise stays injected.
- **Substrate / migration target:** DOM Parts `ChildNodePart`, per the bar's criterion 4.
- **No statute overlap:** `resource:loader` (composed fetch state-machine) vs `async` (one-promise primitive);
  #1978 (sync render error) vs `async`'s `catch` (async rejection). Red-teamed — primitive-vs-composed holds.
- **Spin-off:** a `blockedBy`-gated build child under [#1975](1975-directive-catalog-net-new-directive-proposals-neither-behavi.md),
  authored in the #1983 form. Naming of the `type` value is under [#1987](1987-attribute-naming-convention-review-colon-namespacing-view-if.md).

## The gate

- **Digest + verdict:** GO. Admit the three-branch async region in #1983's ruled form (`<template type="async">`);
  supersede the `async:boundary` spec stub by **folding it in** — it's a single-fallback stub with no distinct
  cross-region-coordination job, so the three-branch form subsumes it (no alias retained).
- **Prior-art delta (vs the existing spec):** the spec has a *single-fallback* `async:boundary`; the field
  (Svelte/Solid/Lit) has a *three-branch* pending/then/catch with `let`-bound resolved + error values. This card
  closes that delta.
- **Why not a fork:** the form is settled catalog-wide by #1983 (Fork 2 (a) — `<template type="async">`) and the
  substrate (DOM Parts) is named, and there is no second coherent admission posture — so it is a one-sided
  go/no-go, not a `## Fork N`.
- **Un-gate trigger:** none pending — this is buildable now against the existing comment/template directive
  infrastructure; the DOM Parts lift is a later migration, not a prerequisite. (Pairs with #1978's sync error
  boundary: `async:await`'s `catch` handles *async* rejection, #1978 handles *synchronous render* errors — see
  #1978's statute-overlap note.)

## Example (proposed authoring)

```html
<!-- Ruled form (#1983 Fork 2 (a)): outer <template type="async"> + nested inert region-templates. -->
<template type="async" value="@user.profile" min-pending="200ms">
  <template slot="pending"><we-spinner></we-spinner></template>
  <template slot="then"><user-card data-bind="value"></user-card></template>
  <template slot="catch"><error-message data-bind="error"></error-message></template>
</template>
```

*(`type` value shown bare per #1983's catalog; spelling under #1987. `min-pending` is the skeptic-amendment timing
knob — a directive attribute, not part of the injected binding. Bindings use `data-bind` per #1983's catalog
rendering, not `let=`/`${}`.)*

- **Framework analog:** Svelte `{#await}/{:then}/{:catch}`, Lit `until()`, Solid `<Suspense>` + resource.
- **Substrate / migration target:** DOM Parts `ChildNodePart`. The promise is injected; the directive owns the
  three-branch *shape* + the pending-timing knob, not the fetch.

## Progress

- **Status:** active — reconciled against #1983 (form now settled catalog-wide); prepared, GO recommended,
  awaiting a ratify turn.
- **Done:** claimed; grounded the spec refs (`async:boundary` stub @ :367, `resource:loader` @ :355 — both
  confirmed); red-teamed the `resource:loader` statute-overlap default (attack fails — primitive vs. composed).
  **Reconciled the form against #1983 (2026-07-01):** async is a pure multi-region *inert* case → #1983's ruled
  Fork 2 (a) form (`<template type="async">` + nested `<template slot>`); rewrote the axis-framing, glance-table
  Form row, and example off the old comment-boundary sketch (which was #1983's rejected Fork 2 (b)). Confirmed
  `async:boundary` is a single-fallback stub with no cross-region-coordination job → disposition = **fold in**.
- **Next:** on ratify go — resolve (record GO + fold-in of `async:boundary`), then scaffold the build item under
  #1975 authored in the #1983 form.
- **Notes:** discussion branched into a general composition-governance finding — filed #2007 (feed-mechanism
  corollary: own-the-shape ⇒ template/attr-expression, never live-DOM) + #2008 (`we-data-table` dual-feed defect,
  gated on #2007). #1976 itself is a clean example of the compliant feed model.

`Skeptic:` SURVIVES-WITH-AMENDMENT (refute-only sub-agent, four axes). Pass-0 (classification): genuine
three-shape tree governance, not computation — holds. Pass-1 (merit): the bare injected promise gives the
directive no place to express **pending-state timing** (debounce / min-display) that every analog ships, so
ergonomics could fall below parity — **amended**: the directive carries a `min-pending`/delay attribute.
Pass-2 (statute-overlap): no collision with `resource:loader` (one-promise primitive vs fetch state-machine) or
#1978 (async reject vs sync render error). Pass-3 (citation-scope): the #1963 bar's criterion-4 (real
standards-track substrate) is satisfied by DOM Parts — not stretched.
