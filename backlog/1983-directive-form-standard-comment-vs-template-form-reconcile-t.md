---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, directive, composition, directive-form, block-standard]
---

# Directive form standard — comment vs template form, reconcile <template is=> with the is=-is-dead ruling

Catalog-wide directive-form rule that #1977 and the other #1975 proposals must apply, rather than each inventing it. **Two parts:** (1) the **selection rule** — when a directive's authoring form is a comment-anchor boundary vs a single `<template>` vs a structural annotation; (2) a real **contradiction to resolve** — the built single-region form `<template is="...">` is a *customized built-in*, which #1963 ruled Safari-dead and never load-bearing. Decide an `is=`-free directive-form standard; touches built code (`portal`, `CustomTemplateDirective`). Blocks #1977 / #1976 / #1978–#1981.

## What's already clear (not up for decision)

- **Inert-required content must live in a `<template>`** — it is the only inert container; "deferred content can't be a bare live child" is forced by the platform, not a choice.
- **Behaviour vs directive** is already ratified (#1963 / block-standard rule 6): `CustomAttribute` first-choice; a directive is the exception for *pre-connection / region control*.
- **The form axis exists** as research ([brainstorm report](../reports/2026-06-29-directive-catalog-brainstorm.md)): Ⓒ comment (body live) · Ⓣ template (body inert) · Ⓐ annotation (no body). It is a *report note*, never codified as a rule.

## The contradiction (why this is a real decision, not bookkeeping)

WE's directives split across two outer forms today, and one of them is on deprecated ground:

| Built directive | Outer form | Mechanism | Cross-browser? |
|---|---|---|---|
| `if`, `for-each`, `switch`, `resource:loader` | `<!-- ns:name -->` (+ `<template slot>` when multi-region) | `CustomComment` | ✅ yes |
| `portal-directive`, any `CustomTemplateDirective` | `<template is="ns:name">` | **customized built-in** (`extends HTMLTemplateElement`, `define(…, {extends:'template'})`) | ❌ **Safari never** |

`fui:plugs/webdirectives/CustomTemplateDirective.ts:46-48` extends `HTMLTemplateElement`; `fui:plugs/webportals/index.ts:54` registers `{ extends: 'template' }`. Both are **`is=` customized built-ins** — exactly what #1963 Fork 1 ruled *not a WE mechanism, lower-compliance, Safari-dead, never load-bearing* (we:docs/agent/block-standard.md:240). So the "simple directive uses `<template is="">`" convention in the webdirectives spec **directly conflicts** with the ratified composition rubric. This must be reconciled before any new directive (defer/async/error-boundary/…) is authored to that form.

## Fork — the `is=`-free directive-form standard

- **(a) Comment-boundary + plain `<template>` (no `is=`) for ALL directives.** *(default)* One uniform form: the directive name lives in the **comment** (`<!-- defer on="visible" -->…<!-- /defer -->`), inertness lives in **plain `<template slot="…">`** children (no `is=`), parsed by the existing `CustomComment` + `multiTemplate` machinery (`fui:plugs/webdirectives/multiTemplate.ts` already scans plain `<template slot>` inside a comment boundary). Cross-browser, single-substrate, consistent with #1963's `is=` ruling. **Cost:** migrate `portal-directive` + `CustomTemplateDirective` off `{extends:'template'}` to the comment form (a real but bounded refactor of built code).
- **(b) Keep `<template is="">` as a polyfilled opt-in; comment form the cross-browser default.** Honours the existing built form, but keeps a Safari-dead mechanism in the standard surface (only as #1963-style accepted-risk PE) and leaves **two** directive forms to teach. Weaker — directives would have a load-bearing form that doesn't work in Safari unless polyfilled.
- **(c) Autonomous custom-element boundary** (`<defer-directive>…</defer-directive>`, a real CE). Cross-browser, but **reintroduces a host node** — defeats the zero-node property that makes directives the right mechanism for region control (#1963). Rejected on the budgeted-host-node spine.

## Selection rule (the output, assuming (a))

| Body shape | Form |
|---|---|
| 1 region, renders **live** (gate presence/count/position) | `<!-- ns:name -->live body<!-- /ns:name -->` |
| 1 region, **inert** until stamped | `<!-- ns:name --><template>…</template><!-- /ns:name -->` (default slot) |
| **N named regions** (states / branches / slots) | `<!-- ns:name -->` + `<template slot="x">` per region |
| no body — metadata on a subtree | structural annotation (`<script type="injector">` / attribute) |

**Invariant:** inert-required content is never a bare live child — always a plain `<template>` (default or named slot) inside the comment boundary. No `is=` anywhere.

## Recommendation
**(a)** — one `is=`-free comment-boundary + plain-`<template>` form for all directives, codified into we:docs/agent/block-standard.md (directive section) as the catalog-wide rule. Resolves the #1963 contradiction, gives #1975's six proposals one form to apply, and the migration of `portal`/`CustomTemplateDirective` off customized built-ins becomes a tracked build child.

## Progress
- **Status:** open — scaffolded as the form blocker for #1977 (created during the #1977 discussion)
- **Next:** ratify the form fork (recommend (a)) → codify in block-standard → scaffold the portal/CustomTemplateDirective migration child → unblock #1977 + siblings
