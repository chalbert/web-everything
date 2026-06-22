---
kind: story
size: 3
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
blockedBy: []
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
tags: [packaging, custom-elements, block-model, conversion, checkbox, form-controls, frontierui]
---

# Convert checkbox to we-checkbox plus we-checkbox-group (persistent light-DOM B)

Register the checkbox block as we-checkbox plus a we-checkbox-group persistent light-DOM group element, the mechanism ruled by #1456 (Fork 1 to B). Mirror the persistent reference at fui:blocks/wizard/WizardElement.ts. Single-input + grouped form participation per #1456.

## Progress

- `fui:blocks/checkbox/CheckboxElements.ts` — `WeCheckbox` + `WeCheckboxGroup`, the **persistent light-DOM (Mechanism B)** elements (per #1456 Fork 1 → B), mirroring the persistent reference `WizardElement.ts`. Unlike the transient presentational controls, a form control **persists** so its real native `<input type=checkbox>` stays in the light DOM and participates in an enclosing `<form>` natively. Both build idempotently in `connectedCallback` via the block's own `createCheckbox` / `createCheckboxGroup` (no second renderer).
  - `we-checkbox`: single boolean — label from text (or `label` attr); `value`/`checked`/`disabled`/`indeterminate`/`name` attrs; `name` flows onto the native input.
  - `we-checkbox-group`: `name` (shared, form grouping), `label` (legend), `select-all` (tri-state master); options declared as direct child `[value]` elements (text = label, `checked`/`disabled` flags), re-rendered through `createCheckboxGroup`.
- `fui:blocks/checkbox/registerCheckbox.ts` — `registerCheckbox(tag = 'we-checkbox', groupTag = 'we-checkbox-group')` (overridable, idempotent, bare standard names #841). Exported from the barrel.
- Unit test `CheckboxElements.test.ts` (5): the single element persists (does NOT self-replace) with a light-DOM native input, reflects disabled/indeterminate, **a real `<form>` collects the native input** (FormData round-trip — the Fork-1-B form-participation proof); the group renders a `role=group` of named native checkboxes from child options + a tri-state select-all master. 16/16 checkbox unit tests green; FUI `check:standards` 0 errors.
