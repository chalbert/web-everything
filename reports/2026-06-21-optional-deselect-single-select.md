# Optional deselect / "allow no selection" for single-select — prior-art survey

**Date:** 2026-06-21 · **Grounds:** decision [#1470](/backlog/1470-selection-intent-optional-deselect-axis-for-single-select-al/) · **Project:** webcomponents (selection intent)

## Question

Native HTML radio cannot be user-unchecked: once a value in a single-select group is chosen, the
user can switch between options but can never return the group to the empty/no-selection state.
Should the WE **selection intent** (`we:src/_data/intents/selection.json`) gain an **optional
deselect / "allow no selection" axis** for `model:single`, and if so, how should it be modelled,
named, and triggered? This survey precedes the forks — it is a greenfield axis (no nullability
dimension exists today).

## 1. Native HTML / ARIA — the empty-state lives in the listbox family, not radio

- **Native radio cannot be user-unchecked.** MDN `radiogroup` role: once a radio is checked, *"it is
  not possible to return to having no radio buttons checked"* — switching options flips the prior
  one's `aria-checked` to `false`, but there is no uncheck-all gesture.
  ([MDN radiogroup_role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/radiogroup_role),
  [MDN radio_role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/radio_role))
- **WAI-ARIA APG** describes a radio group only as a set where *"no more than one of the buttons can
  be checked at a time"* — mutual exclusivity, silent on returning to none.
  ([APG radio pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/))
- **`aria-required` is the *inverse* axis** — it marks "a value must be chosen before submit," the
  opposite of an optional/nullable single choice. The platform codifies *required*, never *optional*.
- **The platform's "single choice that can be empty" idiom is `<select>`**, expressed via a
  placeholder/empty option (`<option value="">Choose…</option>`). The empty-state idiom lives in the
  **listbox/select** family, not the radio family. Open UI's customizable-select inherits that
  lineage; no standardized `clearable` semantic exists yet.
  ([Open UI customizable select](https://open-ui.org/components/selectlist/))

## 2. React Aria (Adobe) `RadioGroup` — none-state via `null`, no user gesture

- `value`/`defaultValue` are typed `string | null` — `null` = no selection — but clearing is a
  **programmatic** act. There is **no documented re-click-to-clear** user behavior (open feature
  request #4971 asks for double-click-to-unselect, confirming its absence).
- `isRequired` is the boolean for the *required* axis (same required/optional framing as native).
  ([React Aria RadioGroup](https://react-aria.adobe.com/RadioGroup),
  [react-spectrum#4971](https://github.com/adobe/react-spectrum/issues/4971))

## 3. Radix UI `ToggleGroup type="single"` — the key precedent

- **Deselect is the default.** Re-activating the active item toggles it back to empty
  (`value → ""`/undefined). A boolean prop *disables* this: *"By default the ToggleGroup allows
  itself to be entirely deselected even after a value has been chosen. This property disables this
  deselect functionality, always keeping a value selected after first selection."* So the model is
  **default-deselectable, opt-out to require a value** — the inverse of native radio.
  ([Radix ToggleGroup](https://www.radix-ui.com/primitives/docs/components/toggle-group),
  bug [primitives#2254](https://github.com/radix-ui/primitives/issues/2254) confirms re-click-to-deselect
  is the intended default)
- **Radix `Select`** has no first-class `clearable` prop; clearing is done by controlling value (the
  x-button affordance is a wrapper concern in the Radix ecosystem).

## 4. Open UI

No ratified deselect/clearable single-select semantic. The customizable-select explainer inherits
listbox/`select` semantics (placeholder/empty option). Clear-on-select / x-button requests recur
across libraries but Open UI has **not** standardized a `clearable`/deselect axis.
([Open UI](https://open-ui.org/components/selectlist/))

## 5. Trigger mechanism — splits by control family

- **Toggle / segmented / chip family → re-activate the active item** (click/tap/re-press → empty):
  Radix `ToggleGroup` (default), Mantine `Select` `allowDeselect`, Mantine `Chip` (hand-rolled
  `if (current === value) setValue(null)`), Chakra radio (hand-rolled `onChange('')`).
- **Dropdown / listbox / `select` family → a dedicated clear ("x") button**: Ant Design `allowClear`
  (and the same affordance requested for MUI Select, Nuxt UI, Semantic dropdown).
- **Escape is *not* a value-clear convention** for single-select — Escape closes popovers / cancels,
  it does not clear the chosen value.
  ([Mantine Select](https://mantine.dev/core/select/),
  [Mantine Chip](https://mantine.dev/core/chip/),
  [Ant Design Select](https://ant.design/components/select/),
  [Chakra #4252](https://github.com/chakra-ui/chakra-ui/discussions/4252))

## 6. Naming convention — a named boolean, never a count-constraint

| Library | Component | Axis name | Polarity |
|---|---|---|---|
| Mantine | `Select` | **`allowDeselect`** (default `true`) | re-click selected → clears |
| Radix UI | `ToggleGroup type="single"` | (deselect on by default) + a **disable-deselect** boolean | opt-out to keep a value |
| Ant Design | `Select` | **`allowClear`** (x button) | explicit clear affordance |
| Native / React Aria | radio group | **`required` / `isRequired`** (the *inverse*) | "must have a value" |
| React Aria | RadioGroup | `value: string \| null` | none-state via null, no named axis |
| Chakra / Zag | RadioGroup | requested `clearValue()` method | programmatic clear |

**No surveyed library models this as a count-constraint** (`min:0`/`minSelections`) on a single-select
control. It is always a **named boolean** (`allowDeselect` / `allowClear`) or its inverse (`required`).
A `min:0` framing only surfaces conceptually for multi-select selection counts.

## Synthesis

- **The pattern is established but family-split.** First-class and *default-on* in the
  toggle/segmented/chip family (Radix `ToggleGroup`, Mantine `allowDeselect`); opt-in via a clear
  button in the dropdown family (Ant `allowClear`); **deliberately absent from native radio** and
  radio-shaped components (React Aria/Chakra reach "none" only programmatically). It is **never**
  standardized at the platform/ARIA layer, where the only codified axis is the inverse, `required`.
- **Dominant naming:** a named boolean — `allowDeselect` (the on-point name for clearing via the
  control's own items, WE's case) or `allowClear` (the dropdown variant). The inverse is `required`.
- **Dominant trigger (radio/segmented shape):** re-activate the already-selected item. Not Escape.
- **Modelling:** a **named boolean axis** is the universal convention; nobody uses `min:0`. WE already
  carries the inverse axis conceptually (`required` / `aria-required`), so the new axis is its
  permissive complement — recommend **default-permissive (deselect allowed)**, opt-out to require a
  value, matching Radix's `ToggleGroup` model.

### Implications for #1470

1. The axis is real surface, platform-aligned (it is the permissive complement of `required`), and
   confirmed by two strong precedents (Radix `ToggleGroup`, Mantine `allowDeselect`).
2. **Model it as a named boolean dimension**, not a count-constraint — every implementation does, and
   `min/max` reads as a count not a per-control UX behavior. This argues Fork 1 **(a)** over **(b)**.
3. **Default permissive** (deselect allowed) per [most-flexible-default], with "require a value" as
   the author's opt-in — exactly Radix's default-deselectable + disable-deselect model.
4. The trigger (re-activate / clear button) is renderer packaging, **not** an intent dimension —
   confirms Fork 2's scope-out (intents are UX-only; keyboard is a fixed mechanic, #1440).
