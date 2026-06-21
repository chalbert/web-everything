---
kind: decision
parent: "1442"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
locus: frontierui
relatedProject: webcomponents
codifiedIn: docs/agent/block-standard.md
tags: [packaging, custom-elements, block-model, conversion, form-controls, decision, frontierui]
---

# Grouped form-control packaging mechanism: transient (A) vs persistent light-DOM (B)

## Ruling (ratified 2026-06-21)

- **Fork 1 → B — persistent light-DOM group element** *(~80%)*. checkbox-group / radio-group persist as
  the `role=group`/`role=radiogroup` custom element, owning the child native inputs and exposing a
  composite `.value`/`.values` property. The group's defining consumer is the controlled-component
  two-way binding (React `value`/`onChange`, Vue `v-model`) — a live property read/write you cannot
  forward without a persistent element — and a group has no native single-element to erase into, so A's
  native-first win is muted. B adds **no extra node** (the group is already a container; B makes that
  container the element). This is §7's **(B) framework-bound/reactive** bucket.
- **Fork 2 → A — transient self-erase → native `<input>`** *(~90%)*. Single checkbox, text-field,
  number-input erase to a real native `<input>` (native form participation / a11y; S1-isolatable via
  #1349 L2). Straight §7 (A) application, identical to the #1381 button; settles the
  single-text-field/number-input form-participation detail → **A**.

*Red-team (the uniformity attack) survived:* `FormData` covers submission, not the live `value`/`onChange`
binding that defines a form group. Residual ~20% is the purist who'd expose group value via a
`CustomAttribute` and keep A uniform.

*Codified:* no §7 statute amend (the rule already stands); added a **worked-example** line to
`we:docs/agent/block-standard.md` §7 pointing here as the form-control application (mirroring the button).
Tags follow #841: `we-checkbox-group`, `we-radio-group`, `we-checkbox`, `we-text-field`, `we-number-input`
via parameterized `register*(tag = …)`. The conversions are #1442 build slices, not authored here.

---

A single form control converts to **A** (transient self-erase to a native input), but a GROUP
(checkbox-group, radio-group) leans **B** (persistent light-DOM). Genuine per-block A-vs-B fork
de-buried from #1442's body. Resolving this also settles form-participation for the single
text-field / number-input (A). Locus FUI; a *consumer refinement* of the §7 packaging-governance
statute set by [#1381](/backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/) /
[#1321](/backlog/1321-variant-component-surface-and-per-variant-loading-one-polymo/) — not a new rule,
an application of one. **This is an FUI impl call** (`locus: frontierui`): the form-control *contracts*
are WE's, the *packaging* is FUI's.

## Axis framing — what's already decided, and what this fork actually is

§7 of `we:docs/agent/block-standard.md` (Packaging governance, ratified #1321/#1381) already gives the
per-block rule: within the default **S1** strategy, pick a block's runtime family by what its **primary
consumer** needs — *behavior-free presentational → (A) transient · framework-bound/reactive → (B)
persistent light-DOM · hostile-CSS opt-in to #1349 S2 → (C) shadow*. So #1456 is **not** a new mechanism;
it is the classification call for the form-control family: **which bucket does a grouped control fall in,
A or B?** (C = #1349 S2 opt-in, not this fork — cite #1349.)

Grounded in the real FUI tree:

- `fui:blocks/checkbox/Checkbox.ts` ships **two surfaces**: `createCheckbox` (a single boolean control —
  `<label><input type=checkbox></label>`) and `createCheckboxGroup` (a `<div role=group>` of independent
  checkboxes + an optional tri-state **"select all"** master).
- `fui:blocks/radio/Radio.ts` ships **only** `createRadioGroup` (`<div role=radiogroup>` of native radios
  sharing a `name`, with **roving-tabindex** + arrow-key navigation). A radio is inherently a group; there
  is no single-radio surface.
- Both groups today are **factories returning a self-contained container**: cross-child coordination
  (`syncMaster`, `checkedValues`, roving `select`/`move`) lives in **JS closures + change/keydown listeners
  bound to the child inputs** — there is no custom element, and no instance field holds selection state
  (`checkedValues()` derives from native `input.checked`).

The single controls (single checkbox, text-field, number-input) each erase to **a real native `<input>`** —
behavior-light, form participation native — so they're the (A) bucket, exactly like the #1381 button. The
open question is **the groups**.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — grouped form-control S1 runtime shape | **B — persistent light-DOM group element** (composite `value`/`values` is a first-class framework-binding surface; no native single-element to erase into; living element re-coordinates dynamic options) | A — transient self-erase (uniform with singles; closures + listeners survive the erase, value read via FormData) | ~80% |
| 2 — single form-control shape (text-field, number-input, single checkbox) | **A — transient self-erase → native `<input>`** | (none — straight §7 application, confirmation not fork) | ~90% |

## Fork 1 — the GROUP's S1 runtime shape: transient (A) vs persistent light-DOM (B)

*Fork-existence (genuine either/or):* both are coherent — a transient group works (its coordination JS
is closure/listener-bound and survives the erase, exactly as #1381 established for the button), and a
persistent group works. But the reference shape is **one or the other**: A leaves a plain `<div role=group>`
+ inputs in the final DOM, B leaves a persistent `<we-checkbox-group>` element. Picked on merit, not effort.

**Crux:** does the group's **primary** consumer need the element to *persist* in JS after upgrade? For the
button #1381 judged "no" (its lost surface — imperative property writes on an element ref — was near-empty,
inputs being attribute-shaped). For a **group the answer flips**, for three reasons specific to grouped
controls, not generic:

1. **The group's `value`/`values` is a first-class, composite reactive surface — and two-way binding is its
   *primary* consumer, not an edge case.** A button has no value a consumer reads back; a group's whole point
   is its selection. The natural framework integration for a form group is the **controlled-component**
   pattern — React `value={…} onChange={…}`, Vue `v-model` — which reads the current selection *as a
   property* and sets it *as a property*. That is precisely the "persistent element ref / property write"
   surface transient gives up after `replaceWith`. For the button that consumer was #1381's red-team edge;
   for a form group it is the mainstream consumer. This maps the group straight onto §7's **(B)
   framework-bound / reactive** bucket.
2. **A group is a synthetic composite with no native single-element to erase into.** The button's (A) win is
   that it ends as *a real native `<button>`* — a complete platform primitive (keyboard/focus/form/SR free).
   A group erases to a `<div role=group>` (or at best a `<fieldset>`) + inputs: its group-ness is **ARIA +
   JS**, not a native element. Roving tabindex and the tri-state master are **custom JS either way** — not
   "free from the platform" — so A's headline native-first advantage is **muted** for a group in a way it
   isn't for a single control.
3. **A living element re-coordinates dynamic options.** Frameworks add/remove options by re-rendering
   children. A persistent (B) element observes its children (slot/mutation) and re-wires roving tabindex +
   master sync; a transient (A) group, erased after first mount, has no element to re-coordinate — later
   option churn requires re-running setup by hand.

- **B — Persistent light-DOM group element (recommended).** `<we-checkbox-group>` / `<we-radio-group>`
  persists as the `role=group`/`role=radiogroup` container, owns the child native inputs, and exposes a clean
  `.value`/`.values` property + observed attributes. Wins: the composite reactive surface frameworks bind to,
  dynamic-option reconciliation, stable JS identity, and it is the element a deployment upgrades to C/S2 when
  it opts into enforced isolation. **Cost (merit):** a persistent wrapper element — but the group is
  *already* a container `<div>`, so B just makes that container the custom element: the wrapper is **not** an
  extra node (unlike the button, where B nests a `<button>` inside a `<we-button>`).
- **A — Transient self-erase (the main alternative).** `<we-checkbox-group>` upgrades, builds the container +
  inputs + closure-bound coordination, then `replaceWith`es itself. Wins: **uniform** with the single
  controls and the §7 button reference; functionally complete (closures + listeners survive; group value
  readable via `FormData` for *submission*). **Cost (merit):** no persistent element for the controlled-
  component `value`/`onChange` binding (the group's primary framework consumer) and nothing to re-coordinate
  dynamic options — the exact surfaces §7 reserves for (B).
- **C — Shadow.** *Not this fork* — the #1349 S2 opt-in (a persistent shadow host); cite #1349, don't
  re-decide. (A *grouped* control crossing into S2 pays the `ElementInternals` form-participation tax per §7
  item 3 — another reason the group's persistent shape (B) is its natural home: B is the family that upgrades
  to C.)

**Recommended default: B (persistent), ~80%.** *Red-team / residual ~20%:* the attack is the
*uniformity* argument — "treat the group like the button: closures + listeners survive the erase, native
radio exclusivity is free from shared `name`, and the value is readable via `FormData`; so A applies
uniformly and B is merely the §7 escape-hatch, same as for the button." Defense: `FormData` covers
*submission*, not the *live two-way `value`/`onChange` binding* that is a form group's defining consumer —
you cannot forward a persistent property *read* without a persistent element — and the group has no native
single-element whose existence makes A's native-first win pay off. The residual is the purist native-first
decider who would rather expose the group value via a `CustomAttribute` / form-associated wrapper and keep A
uniform across the whole family. *Flag for the deciding agent's skeptic sub-pass* — Fork 1 sets the shape
the whole form-control family inherits.

## Fork 2 — single controls (text-field, number-input, single checkbox) → A (confirmation, not a fork)

A single form control erases to **a real native `<input>`** — `createCheckbox` → `<input type=checkbox>`
(with native `indeterminate`), text-field → `<input type=text>`, number-input → `<input type=number>`.
Behavior-light, form participation native, S1-isolatable via #1349 L2 — a straight §7 (A) application,
identical reasoning to the #1381 button. No genuine alternative (B's persistent element buys a single input
nothing its native control doesn't already give). **~90%.** This settles the "form-participation detail for
single text-field/number-input" the digest flagged: **A**.

## Outcome (on ratification)

The §7 statute already carries the *rule*; this decision records the **classification** of the form-control
family under it (so #1442's per-block conversion slices inherit it without re-deciding):

- **grouped controls (checkbox-group, radio-group) → (B) persistent light-DOM** — the composite reactive
  surface case;
- **single controls (single checkbox, text-field, number-input) → (A) transient → native `<input>`**.

No statute amend is needed (§7 already states the rule); add a one-line worked-example note pointing here as
the form-control application, mirroring how the button is §7's worked example. Tags follow #841:
`we-checkbox-group`, `we-radio-group`, `we-checkbox`, `we-text-field`, `we-number-input` via parameterized
`register*(tag = …)`. The actual conversions are #1442 build slices, not authored here.
