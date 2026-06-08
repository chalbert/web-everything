---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-07"
tags: [block, form, form-state, validation, dirty, submit, candidate, harvest]
relatedProject: webblocks
---

# Form block — field/form state model and lifecycle actions

A **Form block** that owns the *form-level* state machine and actions, sitting above the field-level Validation Intent / Web Validation project (which own per-field rules and validity). Web Validation answers "is this field valid?"; there is no block that answers "what is the state of the whole form, and how do I reset/submit/initialize it?"

The contract, grounded in the native `<form>` element and the Constraint Validation API:

- **State** — aggregate `valid`/`invalid`, `touched`/`untouched`, `focused`/`unfocused`, `dirty`/`pristine` across fields.
- **Values** — `initialValues` / `defaultValues` / current `values`; the dirty check is current-vs-initial.
- **Actions** — `submit`, `reset` (to defaults), `clear` (to empty), `initialize(initialValues?)` (re-seed and mark pristine).

It composes existing intents rather than redefining them: **Validation Intent** (field validity merges up to form validity), **Navigation Guard** ([#129](/backlog/129-navigation-guard-intent/) — arm the unsaved-changes guard from `dirty`), and the **Feedback/Reliability** intents for submit lifecycle (in-flight, success, error).

## Scope to design (via [design-first.md](../docs/agent/design-first.md))

- Native-first: lean on `<form>`, `FormData`, the Constraint Validation API, `formAssociated` custom elements (the autonomous-CE form callbacks) — add only the aggregate state/actions the platform doesn't expose.
- How form validity merges from field validity (last-writer vs. strictest — cross-ref the open validation validity-model decision).
- The dirty/pristine baseline (current-vs-initial) and how `initialize` re-baselines it.

> **Provenance:** surfaced during a final review of the legacy `plateau` repo (`form.md`). **Plateau is not a model and must not be consulted or copied** — build this fresh on the native form + validation primitives.
