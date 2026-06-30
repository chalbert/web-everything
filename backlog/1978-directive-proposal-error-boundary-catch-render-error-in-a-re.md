---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, composition, directive, error-boundary, plug, validation-gate]
---

# Directive proposal — error boundary (catch render error in a region, render fallback)

**Prepared (validation gate).** A go/no-go on **admitting** a net-new directive at the
[#1963 framework-parity bar](../docs/agent/block-standard.md#composition-rubric). Catch errors thrown while
rendering/connecting a subtree and render a **fallback** region instead of propagating. Shipped by Solid, React,
Vue, Svelte 5 and Angular (`@error`) — **but with no platform analog of any kind**, which makes this the one
sibling whose admission is *contested*. **Recommendation: GO — admit as a deliberately-scoped plug
([#95](../docs/agent/platform-decisions.md), "Plug = Proposed Missing Standard"), with NOT-YET on a named native
migration target** (a standards-direction watch, not a blocker). The honest alternative verdict (not-yet) is
named below.

## Grounding digest

Unlike its four catalog siblings — async region (DOM Parts), virtualized iteration (content-visibility),
snippet+render (Template Instantiation), content-security (Sanitizer API) — error-boundary has **no native
substrate and no standards-track proposal** to migrate toward (catalog report
[§9](/research/directive-catalog-brainstorm/); the spec's directive table has no error entry,
[we:src/_includes/project-webdirectives.njk:355-368](../src/_includes/project-webdirectives.njk#L355-L368)). The
#1963 bar's **criterion 4** says a plug must be "authored to the standards-track *direction* and designed to be
deprecated + migrated when the native standard ships." With no such direction yet, this is a genuine
net-new invention — exactly the case #95 sanctions ("invent the missing standard"), but also the case where the
admission is weakest. The other half of the bar (criterion 3 — *every case needs a no-compromise solution*) cuts
the other way: render-error recovery **is** a real composition case the field universally solves, and leaving it
uncovered is itself a bar violation. The card sits between those two pressures.

## Axis framing — the two skeptic attacks, reconciled

A refute-only skeptic pass returned **REFUTED** on a naive "go." Both prongs are folded in here rather than
papered over:

1. **"Error-catch is runtime computation, not tree-shape."** *Partially answered.* The directive's **output** is
   region selection — *which of {guarded region, fallback region} exists* — which is **conditional existence**,
   the same tree-shape primitive as `if`/`switch`. The *trigger* (a thrown error) is a runtime signal rather than
   a truthy expression, but a directive may key existence off any signal; it does not *compute* over content.
   **Amendment (folded):** scope the directive to **existence-gating only** — it stamps `fallback` on error and
   nothing else; it must **not** grow into a general `try/catch`-compute construct (no error *transformation*, no
   retry-logic-in-markup). That keeps it on the tree-shape side of the line.
2. **"A plug with no native migration target isn't a legit plug."** *This is the real, unresolved weakness.* #95
   makes WE's own webdirectives proposal *a* standards-track direction (a plug proposes the missing standard, cf.
   `portal` before a native primitive existed). But criterion 4's "designed to migrate when the native standard
   ships" presumes a *plausible native shape* to migrate toward, and there is none today. **Reconciliation:**
   admit it, but record the migration target as a **watch** (file/track a declarative error-region direction),
   and downgrade confidence accordingly. If the decider weights criterion 4 strictly, the **not-yet** verdict
   (below) is the defensible alternative.

## Recommended path at a glance

| Question | Verdict | Why |
|---|---|---|
| Admit at the #1963 bar? | **GO — as a scoped plug (#95)** | Universal framework feature (criterion 3 — uncovered case is itself a bar violation); existence-gating output keeps it tree-shape. |
| Tree-shape vs app-logic? | **Scope to existence-gating; forbid error-transform / retry logic in markup** | Skeptic pass-1 amendment — without the scope it drifts to runtime compute. |
| Native migration target? | **NOT-YET / watch — none exists** | Skeptic pass-3: criterion 4 has no native direction; record a watch, don't claim a substrate. |
| Honest alternative verdict | **not-yet** — defer until a declarative error-region direction is proposed (or WE files one) | For a decider who weights criterion 4 strictly; named so the gate isn't a one-sided "go." |

## The gate

- **Digest + verdict:** GO as a scoped plug, with a NOT-YET rider on the migration target. Not a `## Fork N` —
  it is a one-sided go/no-go on a candidate (the third decision archetype), with the *contested* axis surfaced.
- **Prior-art delta:** the spec has **no** error-boundary directive; the field universally ships one. This card
  proposes the missing primitive.
- **Why not a fork:** there is no second *coherent admission posture* to weigh — the live tension is go-as-plug
  vs not-yet (a confidence call on criterion 4), which the gate states directly rather than as branches.
- **Un-gate / migration trigger:** none blocks the *build* (buildable now over the comment-anchor + template
  infrastructure). The **migration** trigger is a future declarative error-region primitive landing in any
  standards venue — at which point the directive deprecates toward it.

## Example (proposed authoring)

```html
<!-- error:boundary -->
  <risky-widget></risky-widget>
  <template slot="fallback" let="err"><p class="error">Something broke: ${err.message}</p></template>
<!-- /error:boundary -->
```

- **Framework analog:** Solid `<ErrorBoundary fallback={…}>`, Svelte 5 `<svelte:boundary>`, React error
  boundaries, Angular `@error`.
- **Form: Ⓒ comment + Ⓣ fallback** — the guarded region is **live** (comment-anchored, renders normally so
  errors can be observed); the `fallback` is an inert `<template>` stamped only on error.
- **Note:** catches render/connect errors in the bounded region and stamps the `fallback` slot instead of
  propagating; pairs with `async:await`'s `catch` ([#1976](1976-directive-proposal-async-region-await-then-catch-suspense-fa.md))
  for **async** rejection vs this directive's **synchronous render** errors — disjoint triggers, no statute
  overlap.

`Skeptic:` REFUTED → reconciled to GO-as-scoped-plug + NOT-YET-on-migration-target (refute-only sub-agent, four
axes). Pass-0/1 (classification/merit): "error-catch is runtime, not tree-shape" — answered by scoping the
output to **existence-gating** (region-vs-fallback selection) and forbidding error-transform/retry compute;
amendment folded. Pass-3 (citation-scope): "no native migration target ⇒ not a legit plug" — **the unresolved
weakness**; #95 makes WE's own proposal a direction, but criterion 4's migrate-to-native presumption has no
target, so confidence is downgraded and a watch recorded. The decider's call is go-as-plug vs not-yet; both are
stated. Pass-2 (statute-overlap): no collision — disjoint from `async:await`'s async `catch`.
