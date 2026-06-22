---
kind: story
size: 3
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, radio, form-controls, frontierui]
---

# Convert radio to we-radio plus we-radio-group (persistent light-DOM B)

Register the radio block as we-radio plus a we-radio-group persistent light-DOM group element, the mechanism ruled by #1456 (Fork 1 to B). Mirror the persistent reference at fui:blocks/wizard/WizardElement.ts. Grouped form participation per #1456.

## Progress

- `fui:blocks/radio/RadioElements.ts` — `WeRadio` + `WeRadioGroup`, **persistent light-DOM (Mechanism B)** (per #1456 Fork 1 → B), mirroring `WizardElement` and the sibling we-checkbox (#1542). The native `<input type=radio>`s persist in the light DOM → native single-select-by-shared-name + form participation.
  - `we-radio-group` (primary): renders the block's `createRadioGroup` (full APG radiogroup — roving tabindex, arrow nav, deselectable) from `name` (shared), `label` (legend), `value` (initial selection), `deselectable` (default on per contract; opt out `="false"`); options are direct child `[value]` elements.
  - `we-radio` (single option): radio is inherently grouped and the block ships no `createRadio` factory, so the single element builds the native option markup inline (matching the group's `fui-radio-group__option` shape) — grouping with siblings by shared `name`.
- `fui:blocks/radio/registerRadio.ts` — `registerRadio(tag = 'we-radio', groupTag = 'we-radio-group')` (overridable, idempotent, bare standard names #841). Exported from the barrel.
- Unit test `fui:RadioElements.test.ts` (2): the group renders a `role=radiogroup` of named native radios with the initial `value` selected; standalone `we-radio`s persist and a real `<form>` reads the checked one by shared name (FormData round-trip — the Fork-1-B form-participation proof). 16/16 radio unit tests green; FUI `check:standards` 0 errors.
