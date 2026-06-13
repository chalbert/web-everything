---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: blocks.json#form (+ block-descriptions/form.njk)
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

## Progress

Authored the **Form** block as a candidate (draft) composition-manifest standard (2026-06-13) — the Droplist pattern, no implementation yet:

- **[blocks.json#form](../src/_data/blocks.json)** — `type: Store`, `status: draft`. `composesIntents: [validation, exit-guard, feedback, reliability]`; exports `FormState`/`FormActions`/`FormValues`; `webStandards` grounds it in HTMLFormElement / FormData / Constraint Validation API / `formAssociated` ElementInternals. Five `designDecisions` capture: sits-above-the-field-layer, native-first substrate, validity-merge deferral, dirty-baseline semantics, and intent composition.
- **[block-descriptions/form.njk](../src/_includes/block-descriptions/form.njk)** — the contract (State / Values / Actions), native-first grounding, a Web-Standards-alignment table, and a composition table mapping each concern to its owning intent.

**Open "scope to design" questions, resolved:**
- *Form-validity merge (last-writer vs. strictest)* → **deferred to the ratified `ValidityMergeRegistry` strategy plane (#212 / #004 OP-1)**: the Form block consumes the `MergedValidity` hand-off shape and does not bake merge math (native-first default = source-reduction over named sources). The item's open cross-ref is thus closed, not re-litigated.
- *Dirty/pristine baseline + `initialize`* → three distinct value sets (`initialValues` / `defaultValues` / `values`); dirty = current ≠ initial; `initialize` re-seeds AND re-baselines to pristine.
- *Native-first* → augments a real `<form>`; adds only the aggregate state + lifecycle actions the platform lacks.

**Verification:** `check:standards` green (0 errors; the new 57th block triggered + was fixed by `gen:inventory` for AGENTS.md), blocks.json parses. The live `/blocks/form/` route 404s **only** on the already-running dev server — eleventy doesn't emit a newly-added pagination permalink without a restart (not done, per the leave-the-server-running rule); existing block routes render and the entry matches the rendering template's fields, so it renders on the next full build.

**Follow-on (not this slice):** a reference implementation of the Form Store + the `formAssociated` wiring, once the contract is reviewed (candidate → active).
