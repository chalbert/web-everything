---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, composition, directive, async, suspense, validation-gate]
---

# Directive proposal — async region (await / then / catch + suspense fallback)

**Prepared (validation gate).** A go/no-go on **admitting** a net-new directive at the
[#1963 framework-parity bar](../docs/agent/block-standard.md#composition-rubric) — not a multi-branch fork (the
form is already settled, below). A region that renders the **pending → resolved → error** branches of a promise,
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

- **Form is settled — Ⓣ template, not a fork.** The three branches are inert `<template slot="pending|then|catch">`s,
  stamped **one at a time** by promise state; only the active branch is live DOM. A comment-anchor (Ⓒ) form
  would render all three branches live at once — *broken*, not a coherent alternative — so this is a forced
  invariant, not an either/or (standing test, [/research/dom-less-composition](/research/dom-less-composition/)
  form axis). Confirmed 2026-06-29.
- **Substrate is named — DOM Parts `ChildNodePart`.** The standards-track migration target the bar (criterion 4)
  requires; the directive is authored to deprecate toward it when DOM Parts ships.

## Recommended path at a glance

| Question | Verdict | Why |
|---|---|---|
| Admit at the #1963 bar? | **GO** — promote `async:boundary` to the three-branch `async:await/then/catch` directive | Universal framework feature, tree-shape-clean (promise injected), real native substrate (DOM Parts), no statute overlap with `resource:loader`. |
| Form (Ⓒ vs Ⓣ)? | **Forced: Ⓣ template** | One branch live at a time needs inert-until-stamped; Ⓒ would render all three. |
| Pending-state timing? | **Amendment (folded): directive owns a `min-pending` / delay attribute; the fetch stays injected** | Skeptic pass-1: a bare injected promise can't express debounce / min-display, which every analog ships — ergonomics (criterion 1) would fall *below* frameworks. Pin the timing knob to the directive's attribute surface, not the binding. |

## The gate

- **Digest + verdict:** GO. Admit `async:await` as the three-branch async region; supersede the `async:boundary`
  spec stub (keep the name as the suspense-coordination alias or fold it in).
- **Prior-art delta (vs the existing spec):** the spec has a *single-fallback* `async:boundary`; the field
  (Svelte/Solid/Lit) has a *three-branch* pending/then/catch with `let`-bound resolved + error values. This card
  closes that delta.
- **Why not a fork:** the form (Ⓣ) and substrate (DOM Parts) are forced/named, and there is no second coherent
  admission posture — so it is a one-sided go/no-go, not a `## Fork N`.
- **Un-gate trigger:** none pending — this is buildable now against the existing comment/template directive
  infrastructure; the DOM Parts lift is a later migration, not a prerequisite. (Pairs with #1978's sync error
  boundary: `async:await`'s `catch` handles *async* rejection, #1978 handles *synchronous render* errors — see
  #1978's statute-overlap note.)

## Example (proposed authoring)

```html
<!-- async:await promise="@user.profile" min-pending="200ms" -->
  <template slot="pending"><we-spinner></we-spinner></template>
  <template slot="then" let="profile"><h2>${profile.name}</h2></template>
  <template slot="catch" let="err"><p class="error">${err.message}</p></template>
<!-- /async:await -->
```

- **Framework analog:** Svelte `{#await}/{:then}/{:catch}`, Lit `until()`, Solid `<Suspense>` + resource.
- **Substrate / migration target:** DOM Parts `ChildNodePart`. The promise is injected; the directive owns the
  three-branch *shape* + the pending-timing knob, not the fetch.

## Progress

- **Status:** open — reopened (unclaimed); prepared, GO recommended, awaiting a ratify turn.
- **Done:** claimed; grounded the spec refs (`async:boundary` stub @ :367, `resource:loader` @ :355 — both
  confirmed); red-teamed the `resource:loader` statute-overlap default (attack fails — primitive vs. composed).
- **Next:** on ratify go — resolve (record GO + the `async:boundary` disposition: alias vs. fold, the one open sub-point),
  then scaffold the build item under #1975.
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
