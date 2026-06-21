---
kind: decision
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-21"
relatedProject: webcomponents
relatedReport: reports/2026-06-21-optional-deselect-single-select.md
tags: [intent, selection, deselect, accessibility, decision]
---

# Selection intent: optional deselect axis for single-select (allow no selection)

**Grounding digest** (full survey: `relatedReport` →
[/research/optional-deselect-single-select/](/research/optional-deselect-single-select/)). Native HTML
radio **cannot be user-unchecked** (MDN `radiogroup`: once checked, no return to none); ARIA codifies
only the *inverse* axis, `aria-required`. The "single choice that can be empty" idiom lives in the
listbox/`<select>` family (empty `<option>`), not radio. The deselect pattern **is** established but
**family-split**: default-ON in toggle/segmented/chip (Radix `ToggleGroup type="single"` deselects on
re-activate by default + a boolean to require a value; Mantine `Select` `allowDeselect` default `true`),
opt-in via a clear button in dropdowns (Ant `allowClear`), and absent from native radio (React
Aria/Chakra reach "none" only programmatically). **Every** implementation names it a **boolean axis**
(`allowDeselect`/`allowClear`, or the inverse `required`) — **none** uses a count-constraint (`min:0`)
on single-select. Dominant trigger for the radio shape: re-activate the selected item (not Escape) —
renderer packaging, not intent vocabulary.

## The axis — can a single-select control be cleared back to "nothing selected"?

`we:src/_data/intents/selection.json` exposes four dimensions — `model` (single/multiple), `immediacy`,
`variant`, `grouping` — and **no nullability/deselect dimension** (its interface block also types a
`constraints?: { min?: number; max?: number }`, currently consumed by nothing). So a radio group
authored with the intent can move *between* options but never back to none. The FUI radio block proves
the gap concretely: `fui:blocks/radio/Radio.ts:38-39` makes the initial `value?` optional ("Defaults to
none selected"), but the only state mutator `select(index)` (`fui:blocks/radio/Radio.ts:80-88`) sets
`el.checked = i === index` across the options and fires `onChange` with the newly-selected value — there
is **no toggle-off path**, so once a value is chosen exactly one stays checked forever (native radio
semantics, #1339). By contrast the **multi-select** side already ships a clear-selection affordance
(#1423 bulk-action bar). The gap is single-select only.

This is real surface, not a native quirk to copy: forms routinely need an **optional** single choice
("None of the above", a filter you can switch off, an un-answerable survey question). Today authors fake
it with a sentinel "None" radio option — which conflates *no selection* with *a selection named none* and
costs a row. The platform-aligned framing is the **permissive complement of `required`/`aria-required`**:
WE codifies the optional side the platform left out.

## Ruling (ratified 2026-06-21)

**Fork 1 → (a): a new named boolean dimension `deselectable: true | false` on the selection intent,
default `true` (deselect allowed).** ~80% confidence. The named-boolean shape is the universal
cross-library convention (Radix `ToggleGroup` disable-deselect boolean, Mantine `allowDeselect`, Ant
`allowClear`) — *no* surveyed library models single-select deselect as a count — and default-permissive
matches Radix `ToggleGroup` exactly, per [most-flexible-default]; "require a value" is the author's
opt-in. **Red-team outcome:** the case for (b) `constraints.min` failed — count-vocabulary is the wrong
model for a single-select UX behavior (legibility), and reusing the unconsumed `constraints` field saves
nothing real. The residual ~20% (unify single+multi nullability under `constraints.min`) was weighed and
rejected: `constraints.min` stays the right model for *multi*-select (a genuine count, #1423) but legibility
wins for single-select. The deselect **trigger** stays renderer packaging (Supported-by-default), not an axis.

Successor builds: add the `deselectable` axis + interface field to `we:src/_data/intents/selection.json`;
add the toggle-off path + clear affordance to `fui:blocks/radio/Radio.ts`.

## Recommended path at a glance

| Fork | Question | Options | **Recommended default** | Confidence |
|------|----------|---------|------------------------|------------|
| 1 | Does single-select get a deselect axis, and how modelled? | (a) new named boolean dimension · (b) fold into `constraints.min` · (c) no axis | **(a) new named boolean dimension `deselectable`, default-permissive (`true`)** | ~80% |

*(Fork 2 — the deselect **trigger** — is **not** a fork: it is renderer/keyboard packaging, scoped out
as "Supported by default" below, confirmed by the survey.)*

## Fork 1 — does single-select get an optional deselect axis, and how is it modelled?

*Fork-existence:* a single-select control is **either** always-has-a-value (current native radio)
**or** can be cleared to empty — a control cannot be both at once, and the difference is author-visible
(whether a clear/toggle-off affordance exists). Both are coherent end-states (native radio is the
former; Radix `ToggleGroup`, menus and filter pills are the latter), so this is a **merit call** on
*where it lives*, not a forced invariant — the genuine either/or is option (a) vs (b): a named axis and
a count-constraint **cannot both be the model** of one behavior without duplicating it.

- **(a) New named boolean dimension on the selection intent — `deselectable: true | false`** (the
  survey's `allowDeselect` convention; default the most-permissive value `true` per
  [most-flexible-default], with "require a value" as the author's opt-in). A first-class axis alongside
  `model`/`immediacy`. The renderer maps it to deselect-on-re-activate (radio/segmented) or an empty-able
  select. *Tradeoff:* adds a dimension to a `draft` intent — but that is exactly the intent's job, it is
  the universal cross-library convention (Mantine `allowDeselect`, Radix's disable-deselect boolean), and
  it borrows the native `required`/optional vocabulary rather than inventing one.
- **(b) Fold into the existing `constraints` ({min,max})** typed in the interface
  (`constraints?: { min?: number; max?: number }`): `min: 0` ⇒ deselect allowed, `min: 1` ⇒ mandatory.
  *Tradeoff:* reuses an existing field and unifies single + multi nullability — but **no surveyed library
  models single-select deselect as a count** (it is always a named boolean); `min/max` reads as a *count*
  constraint, less legible as a per-control UX behavior, and nothing consumes `constraints` yet, so the
  "reuse" saves nothing real.
- **(c) No axis — keep single-select always-selected; "optional" stays an authored "None" option.**
  *Tradeoff:* zero surface change, but perpetuates the sentinel-option workaround (conflates no-selection
  with a-selection-named-none) and leaves a genuine, platform-shaped forms gap unfilled.

**Recommended default: (a) a named boolean dimension `deselectable`, default `true` (deselect
allowed).** ~80% confidence. Rationale grounded in the survey: the named-boolean shape is the *universal*
convention across Radix/Mantine/Ant — nobody uses `min:0` — and default-permissive is the exact Radix
`ToggleGroup` model (default-deselectable, opt-out to require a value), aligning with
[most-flexible-default]. *The residual ~20%:* if the intent's maintainers prefer one unified nullability
mechanism across single **and** multi (where multi genuinely *is* count-shaped via #1423), (b) becomes
attractive — fold both into `constraints.min`. **Red-team the default:** the skeptic will argue (b) avoids
adding a dimension and unifies the two models; the counter is that count-vocabulary is *wrong* for a
single-select UX behavior (legibility) and "reuse" of an unconsumed field is not a real saving — name the
axis after what authors mean (`deselectable`), not after a count that happens to encode it.

---

## Supported by default (not forks)

- **The deselect *trigger* (re-click vs key/gesture) is renderer packaging, not an intent dimension.**
  Per [intent-ux-only] the intent expresses *that* a single-select can be cleared (the UX behavior),
  never *which* gesture does it. The survey confirms the trigger splits by control family
  (re-activate the active item for radio/segmented; an "x" clear button for dropdowns; Escape is *not*
  used) — all renderer/packaging detail. WE models keyboard as a **fixed mechanic, not a configurable
  dimension** (#1440), and any per-app rebinding rides the keyboard-shortcuts block
  (`we:src/_data/blocks/keyboard-shortcuts.json`), not the selection intent. This was originally framed
  as "Fork 2" but has no excluded branch — there is no coherent alternative under which the intent
  *would* standardize a keybinding — so it is support-by-default, not a fork (#819).

## Context

- **Origin:** user question 2026-06-21 — "do we have an optional unselect behavior for radio, possibly on
  a configurable shortcut?" Answer was *absent*; this card files the gap.
- **Multi-select counterpart already exists:** clear-selection affordances ship for `model:multiple` via
  the bulk-action bar (#1423) — this is the single-select analogue, so the two should end up consistent
  (the Fork 1 residual turns on exactly this consistency pull).
- **Implementations to update on ratify:** `we:src/_data/intents/selection.json` (add the axis +
  interface), `fui:blocks/radio/Radio.ts` (#1339 — add the toggle-off path in `select()` + a clear
  affordance), and any select/segmented renderers of `model:single`.
- **Not in scope:** changing multi-select, or standardizing a specific keybinding (Supported-by-default).
