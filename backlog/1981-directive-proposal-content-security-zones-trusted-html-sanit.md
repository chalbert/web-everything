---
kind: decision
parent: "1975"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: "#2146 — content-security directive pair build child (form per #1983; native-policy-only fence + trusted-html thinness note per #1981 ruling)"
codifiedIn: one-off
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

## Ruling — ratified 2026-07-02

- **Verdict: GO.** Admit the `trusted:html` + `sanitize:content` pair at the #1963 bar, authored toward the
  **native Sanitizer API** (`Element.setHTML()`) and **Trusted Types**; DOMPurify demoted to fallback-only. Build
  child: [#2146](2146-build-the-content-security-directive-pair-sanitize-content-t.md).
- **Normative constraint (binding, folded from the prep skeptic):** the directive may only **invoke the native
  policy** — declarative configs / policy names are fine; **author-supplied transform functions are barred**.
  Admitting custom transforms would cross the tree-shape↔app-logic line and is a new decision, not an extension.
- **Form (settled, #1983 — reconciled into this item 2026-07-02):** Ⓣ typed `<template>` — doubly forced (#1983
  ratified the single-region form; independently, a comment boundary would admit live content before sanitizing).
  `type=` values per #1987: `type="sanitize-content"` / `type="trusted-html"`; the colon spellings remain the
  catalog/spec directive names.
- **Red-team (ratify pass, held with a noted thinness):** *"`trusted:html` has no native per-region lever —
  Trusted Types enforcement is page-scoped via CSP."* Held: the directive approximates region enforcement by
  admitting only `TrustedHTML` values (rejecting strings) into the zone — enforceable, but a directive-invented
  semantic rather than a native policy applied to a region. `trusted:html` is admitted as **the thinner of the
  pair**; `sanitize:content` → `setHTML()` is the clean native mapping. Surfaced to the decider pre-ratify;
  ratified as a pair regardless.

## Example (proposed authoring)

*(Example reconciled 2026-07-02 to the ratified [#1983 directive-form standard](1983-directive-form-standard-comment-vs-template-form-reconcile-t.md)
— the prep's original comment-boundary spellings predate that ruling and are struck. For this proposal the Ⓣ
typed-template form is doubly forced: #1983 ratified it as the single-region form, and the security argument
independently requires inert-hold (a comment boundary would admit live content before sanitizing). `type=` values
follow #1983/#1987 (`type="sanitize-content"` / `type="trusted-html"` — hyphen in `type=`; the colon spellings
remain the catalog/spec directive names).)*

```html
<!-- run untrusted content through the native Sanitizer before it lands (catalog name `sanitize:content`) -->
<template type="sanitize-content" policy="strict">
  ${commentBody}
</template>

<!-- enforce Trusted Types on a content zone (catalog name `trusted:html`) -->
<template type="trusted-html">
  ${policyApprovedMarkup}
</template>
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
