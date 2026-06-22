---
kind: story
size: 5
parent: "1254"
locus: plateau-app
status: open
dateOpened: "2026-06-22"
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

## Split lineage (2026-06-22, `/split 1506`)

Carved as a sibling of #1506 per [split-analysis report Run 9](../reports/2026-06-22-backlog-split-analysis.md).
The two configurators are fully independent (separate files, routes, localStorage; zero cross-imports), so
this slice and #1506 are both `blockedBy: []` and proceed in parallel. The FUI form controls are imperative
factories, so consumption is per-control wiring (config + returned handle + onChange), not a tag swap — the
NL box + verdict scaffolding have no FUI equivalent and stay bespoke. No new design fork — the dogfood
target + #1286 controls are ratified.
