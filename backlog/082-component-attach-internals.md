---
type: decision
workItem: story
size: 3
parent: "076"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: "2026-06-06"
dateResolved: "2026-06-11"
graduatedTo: block:component
tags: [webcomponents, component, declarative, attach-internals, accessibility, forms]
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-12/13/14 — Declarative `attachInternals()` surface on `<component>`

`attachInternals()` / `ElementInternals` is the platform's **imperative-only** surface for form participation, default ARIA semantics, and custom states — none has an HTML form today, so it is the richest declarative target for `<component>`. This thread tracks the three sub-decisions; the first two are **implemented (tier 2)** with a current recommendation, the third is **deferred**.

- **DC-12 — form participation.** Recommendation: **`form-associated`** (boolean attribute) → emits `static formAssociated = true` + `this.attachInternals()`, so the element participates in forms (gets `:disabled` from a fieldset, form-lifecycle callbacks, `form`/`labels` access). Form **value & validation wiring** is out of scope here — it composes with Web Validation later.
- **DC-13 — default ARIA role.** Recommendation: **`default-role="…"`** → sets `internals.role` default semantics in the constructor; an instance `role=` attribute still overrides for assistive tech. Chosen **over reusing `role=`** on the definition element, which would be ambiguous (the definition's own role vs. the defined element's default). Validated to an ARIA role token. Other `aria-*` defaults are deferred.
- **DC-14 — custom states (`:state()`).** Recommendation: **defer.** States are added/removed at runtime; only *seeding* initial states (`states="…"`) is declarative, and that is low-value versus runtime toggling. Revisit when a concrete use lands.

**Runtime note.** The generated class is the source-of-truth output for real browsers. The runtime twin (`defineFromDefinition`) **guards `attachInternals`** because some non-browser test runtimes (happy-dom) lack it — the twin no-ops there while the conformance suite asserts the *generated source*, and the playground (Chromium) exercises the real behavior.

**Open edges:** whether to ever surface other `aria-*` defaults declaratively; the eventual shape of form value/validation composition with Web Validation; and reconsidering DC-14 if state seeding proves useful.

## Resolution (2026-06-11)
**Ratified by native-first (mirror the platform verbatim).** DC-12 ships as `form-associated` → `static formAssociated = true` + `attachInternals()`; DC-13 ships as `default-role="…"` → `internals.role` (instance `role=` still overrides). Both already implemented (tier 2). DC-14 (`:state()` seeding) stays **deferred** — runtime-added states have no declarative platform precedent, so inventing a surface would violate native-first; revisit when a concrete use lands. The open edges (other `aria-*` defaults, form value/validation composition) ride with Web Validation and future `<component>` work, not this decision.
