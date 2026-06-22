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

# plateau-app Technical Configurator surface onto FUI form controls

Migrate the Technical Configurator (`plateau:src/technical-configurator/configurator.ts`, 619 lines) off
hand-rolled DOM onto FUI form controls — `createTextField` (`fui:blocks/text-field/TextField.ts`) for the
NL input box (`renderRequirements` at `:249`, box at `:218`/`:228`), `createRadioGroup`
(`fui:blocks/radio/Radio.ts:62`) / `createNumberInput` (`fui:blocks/number-input/NumberInput.ts:79`) for
the axis/preset controls (`renderAxisRequirement` at `:289`) — while **retaining** the bespoke
NL-provider seam (`registerNLProvider`/`keywordNLProvider` at `:30`/`:22`), the verdict engine
(`renderStrategyList` at `:363`), and the domain tabs. Sibling of #1506 (Intent Configurator) under
#1254; split via `/split 1506`. Gates on a rendered a11y/visual check per first-party-dogfood.

## Progress

- `plateau:src/technical-configurator/configurator.ts` — migrated onto FUI form controls (consumed as `@frontierui/blocks/*`, dogfooding the impl):
  - **NL goal box** (`renderNLBox`) → FUI `createTextField`; the field's accessible label carries the "describe in plain language (provider)" prompt; the bespoke **Interpret** button + Enter-to-run stay, calling `applyNLDescription(field.getValue())`.
  - **Requirement axes** (`renderAxisRequirement`) → FUI `createCheckboxGroup`. The axes are **multi-select** with per-value definition tooltips, so the lossless control is the checkbox group, **not** the single-select radio the card speculated (remediated: radio can't represent multiple accepted values). The per-value definition tooltip — which FUI `CheckboxOption` has no field for — is preserved by setting `title` on each rendered option label (same call as #1506's chips). The per-value `toggleRequirement` is replaced by a set-based `setAxisAccepted(axisId, values)` fed by the group's `onChange`.
  - **Retained bespoke** (per the card): the NL-provider seam (`registerNLProvider`/`keywordNLProvider`/`describeRequirements`), the verdict engine (`renderStrategyList`), the preset chips, and the domain tabs. `createNumberInput` was **not** used — the model has no numeric axis (categorical `{id,label,definition}` values), so forcing it would be a wrong fit.
  - FUI control CSS (`TEXT_FIELD_CSS` + `CHECKBOX_CSS`) injected once on mount; the checkbox-group legend is visually hidden (the axis head already shows the label).
- `plateau:tsconfig.json` — added the `@frontierui/blocks/*` path mapping (was absent — deep FUI block imports resolved at runtime/test via the Vite/vitest alias but failed `tsc`); this makes both #1546 **and** #1506's dogfooded imports typecheck clean.
- **Rendered a11y/visual check** (Playwright, :4000, after sim-login): `/technical-configurator` shows the FUI text field (NL box), 6 axis `role=group` checkbox groups (24 checkboxes), legend visually hidden, **all 24 options retain their definition tooltip**, toggling an axis re-renders the verdict/strategy list, **zero console errors**. Screenshot eyeballed — clean.
- Gate: plateau-app `npm test` 259/259 green.

## Split lineage (2026-06-22, `/split 1506`)

Carved as a sibling of #1506 per [split-analysis report Run 9](../reports/2026-06-22-backlog-split-analysis.md).
The two configurators are fully independent (separate files, routes, localStorage; zero cross-imports), so
this slice and #1506 are both `blockedBy: []` and proceed in parallel. The FUI form controls are imperative
factories, so consumption is per-control wiring (config + returned handle + onChange), not a tag swap — the
NL box + verdict scaffolding have no FUI equivalent and stay bespoke. No new design fork — the dogfood
target + #1286 controls are ratified.
