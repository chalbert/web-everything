---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, composition, directive, content-security, sanitizer, validation-gate]
---

# Directive proposal — content-security zones (trusted-html / sanitize-content)

**Prepared (validation gate).** A go/no-go on **admitting** a region-level content-policy directive at the
[#1963 framework-parity bar](../docs/agent/block-standard.md#composition-rubric): `trusted:html` enforces Trusted
Types on a content zone; `sanitize:content` runs the native Sanitizer API over a user-content zone. Novel and
genuinely directive-shaped (a policy *over a region*, not a connected-element behavior). Catalog report
[§15](/research/directive-catalog-brainstorm/) tags it 🟢 high-value. **Recommendation: GO.** *(No `## Fork N` —
the apparent naming fork is settled by precedent, below.)*

## Grounding digest

Both `trusted:html` and `sanitize:content` are **already proposed in the webdirectives spec** as *Security
Directives* ([we:src/_includes/project-webdirectives.njk:379-384](../src/_includes/project-webdirectives.njk#L379-L384)
— "Enforce Trusted Types on content zones" / "Apply DOMPurify to user content"). This card promotes those stubs
to first-class directives and pins the substrate to the **native Sanitizer API** (`Element.setHTML()` /
`setHTMLUnsafe()`) and **Trusted Types** — a real criterion-4 migration target (the spec's "DOMPurify" note
becomes a fallback behind the native Sanitizer). It is **directive-shaped, not a behavior**: it governs *how a
region's content is admitted* (a pre-insertion content policy) and **must act before content materializes** — a
behavior attaches only *after* its element connects, too late to gate admission.

## Axis framing

The decisive property is **admit-after-policy**: the raw content is held **inert** in a `<template>`, the policy
(Sanitizer / Trusted Types) runs, and only then is the result stamped — exactly what `<template>`'s native
inertness buys (form axis, [/research/dom-less-composition](/research/dom-less-composition/)). A comment-anchor
(Ⓒ) form would admit **live** content *before* sanitizing — a security hole, so Ⓣ is forced, not chosen. The one
line to watch is tree-shape↔computation: `sanitize:content` *runs a transform over content*, the closest of the
five candidates to the app-logic line — it stays legitimate **only** because the transform is the **native
Sanitizer policy** (governing *in-what-form content exists*), never author-supplied arithmetic (skeptic
amendment, below).

## Recommended path at a glance

| Question | Verdict | Why |
|---|---|---|
| Admit at the #1963 bar? | **GO** — promote `trusted:html` + `sanitize:content` to first-class directives | Novel high-value case, real native substrate (Sanitizer API + Trusted Types), genuinely directive-shaped (pre-insertion region policy). |
| Namespace (`security:*` vs `trusted:`/`sanitize:`)? | **Settled by precedent — use `trusted:html` / `sanitize:content`** (the names already in the spec) — *not a fork* | The item's draft `security:sanitize` spelling was a gratuitous divergence; aligning to the existing proposed names is forced, not an either/or. |
| Tree-shape vs app-logic? | **Native Sanitizer / Trusted Types policy ONLY — no author-supplied transform** | Skeptic pass-1 amendment: an inline custom sanitizer function would cross into app-logic; the directive may invoke only the native policy. |

## Supported by default (forced — not a fork)

- **Namespace = the existing spec names.** `trusted:html` and `sanitize:content` are already the proposed
  spellings ([:379-384](../src/_includes/project-webdirectives.njk#L379-L384)); the earlier draft's
  `security:trusted-html` / `security:sanitize` is a needless rename whose only effect is inconsistency — the
  excluded branch is simply *wrong*, so by the standing test this is a forced invariant (ratify), not a `## Fork`.

## The gate

- **Digest + verdict:** GO. Admit `trusted:html` + `sanitize:content`, authored toward the native Sanitizer API
  + Trusted Types.
- **Prior-art delta:** the spec lists both as one-line stubs; this card pins their substrate (native Sanitizer,
  not DOMPurify-as-primary), form (Ⓣ inert-then-stamp), and the no-author-transform scope.
- **Why not a fork:** the namespace is settled by precedent and the form is forced; there is no second coherent
  admission posture — a one-sided go/no-go with a scope amendment.
- **Un-gate trigger:** none — the native Sanitizer API ships in current browsers; buildable now.

## Example (proposed authoring)

```html
<!-- run untrusted content through the native Sanitizer before it lands -->
<!-- sanitize:content policy="strict" -->
  ${commentBody}
<!-- /sanitize:content -->

<!-- enforce Trusted Types on a content zone -->
<!-- trusted:html -->
  ${policyApprovedMarkup}
<!-- /trusted:html -->
```

- **Substrate:** the native **Sanitizer API** (`Element.setHTML()` / `setHTMLUnsafe()`) and **Trusted Types** —
  the directive is a declarative wrapper that applies the *native* policy to the bounded region (DOMPurify only
  as a fallback where the Sanitizer API is unavailable).
- **Why a directive (not a behavior):** it governs *how a region's content is admitted* (a pre-insertion content
  policy), not a connected element's behaviour — and it must act **before** the content materializes.
- **Form: Ⓣ template** — hold the raw content **inert**, run the policy (Sanitizer / Trusted Types), *then*
  stamp; admit-after-policy is exactly the inert-hold `<template>` gives. A comment form would admit live content
  before sanitizing.

`Skeptic:` SURVIVES-WITH-AMENDMENT (refute-only sub-agent, four axes). Pass-0 (classification): the naming
"fork" is settled by precedent (align to the existing `trusted:html`/`sanitize:content` spec names) — **demoted
from a `## Fork N` to a forced default.** Pass-1 (merit): `sanitize:content` is the closest of the five to the
app-logic line because it *transforms* content — survives **only** because the transform is the **native
Sanitizer policy** governing *in-what-form content is admitted*; **amendment folded: forbid author-supplied
transform logic** (native policy invocation only). Pass-2/3: directive-shaped (pre-connection, region-scoped, not
a behavior) holds; native Sanitizer + Trusted Types is a real criterion-4 substrate.
