---
kind: story
size: 5
parent: "1254"
locus: plateau-app
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
relatedReport: reports/2026-06-22-backlog-split-analysis.md
tags: []
---

# plateau-app Intent Configurator surface onto FUI form controls

Migrate the Intent Configurator (`plateau:src/intent-configurator/configurator.ts`, 403 lines) off
hand-rolled DOM onto FUI form controls. Swap the add-custom-value form's text inputs onto
`createTextField` (`fui:blocks/text-field/TextField.ts`) and option selection onto FUI radio
(`createRadioGroup`, `fui:blocks/radio/Radio.ts:62`) where lossless, while **retaining** the bespoke
chip-CRUD scaffolding — `renderDimension` (`:204`) / `renderCustomChip` (`:242`, per-chip delete `×` at
`:259`) / `renderAddCustomForm` (`:270`). FUI `RadioOption` (`fui:blocks/radio/Radio.ts:20-28`) has **no
per-option delete**, so mapping chips→radio wholesale would regress the inline custom-value-delete UX;
keep the chip-CRUD around the FUI inputs. Ratchet release of #1254 now that the FUI form-controls gap
#1286 shipped. Gates on a rendered a11y/visual check per first-party-dogfood.

## Progress

- `plateau:src/intent-configurator/configurator.ts` — migrated onto FUI form controls (consumed as `@frontierui/blocks/*`, dogfooding the impl):
  - **Standard options** (`renderDimension`) now render through FUI `createRadioGroup` (`@frontierui/blocks/radio/Radio`) — single-select a11y (`role=radiogroup`, roving tabindex, arrow nav) for free. "Default" is the explicit clear option (value `''`, `deselectable: false`); a custom token being active leaves the radio unselected (its chip carries the active state). Removed the now-superseded `optionButton` helper.
  - **Add-custom-value form** (`renderAddCustomForm`) text inputs → FUI `createTextField` (`@frontierui/blocks/text-field/TextField`); the token field's validation message rides its own error status (`setStatus('error', …)`), replacing the bespoke error `<p>`.
  - **Bespoke chip-CRUD retained**: custom values stay chips with the inline `×` delete (`renderCustomChip`) — FUI `RadioOption` has no per-option delete, so mapping them to radio would regress the custom-value-delete UX.
  - FUI controls carry styling as exported CSS constants (`TEXT_FIELD_CSS` / `RADIO_CSS`) injected once on mount; the radio legend is visually hidden (kept in the a11y tree) since the dimension already shows its name via `.ic-dim-label`.
- **Rendered a11y/visual check** (Playwright, :4000, after sim-login): `/intent-configurator` renders 269 `role=radiogroup` groups (1042 radios), legend visually hidden, the add-form shows 3 FUI text fields (token label "Custom value token"), selecting a radio updates the live output snippet, **zero console errors**. Screenshot eyeballed — clean.
- Gate: plateau-app `npm test` 259/259 green.

## Split lineage (2026-06-22, `/split 1506`)

Sliced per [split-analysis report Run 9](../reports/2026-06-22-backlog-split-analysis.md). This story was
re-sized 5→8→13 across two pre-flights, then split into two independent per-configurator slices (separate
files, routes, localStorage; zero cross-imports). Because #1506 already has `parent: 1254`, it stays a
`story` re-scoped in place to the **Intent Configurator** slice (13→5); the **Technical Configurator**
half was carved as a sibling under #1254. No new design fork — the dogfood target + #1286 controls are
ratified.
