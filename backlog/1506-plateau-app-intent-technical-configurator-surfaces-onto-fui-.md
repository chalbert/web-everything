---
kind: story
size: 8
parent: "1254"
locus: plateau-app
status: open
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
tags: []
---

# plateau-app Intent + Technical Configurator surfaces onto FUI form controls

Migrate the Intent Configurator (plateau:src/intent-configurator/configurator.ts) and Technical Configurator (plateau:src/technical-configurator/configurator.ts) off hand-rolled DOM onto FUI form controls (radio/checkbox/text-field/number/droplist) + NL input + verdict panel. Ratchet release of #1254 now that the FUI form-controls gap #1286 shipped. Gates on a rendered a11y/visual check per first-party-dogfood.

## Pre-flight (batch-2026-06-22-1510-1483) — outgrew 5 → 8; faithful migration is a hybrid rework, recommend `/split` into per-configurator slices

Claimed + ground both surfaces and the FUI form-control blocks (#1286 / #1339–#1342). Two findings re-scope this:

1. **The FUI form controls are imperative FACTORIES, not declarative tags** — `createTextField(config)` / `createRadioGroup(config)` / `mountX(root, config)` (`fui:blocks/text-field/TextField.ts`, `fui:blocks/radio/Radio.ts`), unlike the `<we-card>`/`<we-badge>` declarative blocks the sibling ratchets (#1507/#1508/#1509) swapped. So consumption is per-control wiring (config object + returned element + onChange), more involved than a tag swap.
2. **The configurators' core UX has no FUI equivalent, so this is a hybrid rework, not a swap.** The Intent Configurator (`plateau:src/intent-configurator/configurator.ts`, 403 lines) renders dimension values as **chips with inline custom-value CRUD** — `renderDimension` + `optionButton` + `renderCustomChip` (per-chip **delete**) + `renderAddCustomForm` (add a vendor-namespaced value). A FUI `createRadioGroup` covers the *selection* but a radio option has **no per-option delete**, so mapping chips→radio would **lose the inline custom-value-delete UX** (a regression) unless bespoke "manage custom values" scaffolding is kept alongside. The Technical Configurator (619 lines) adds the **NL-provider box** (`registerNLProvider`/`keywordNLProvider` seam) + a **verdict engine** + domain tabs — also bespoke, only partly form-controls.

So a faithful migration is a **judgment-heavy hybrid rework across 1022 lines in two surfaces** (FUI factories for the basic inputs — the add-custom-value form's text-fields, the NL box, any radio/number/checkbox requirement controls — while retaining/replacing the chip-CRUD + NL + verdict scaffolding without regressing it), each needing a rendered a11y/visual check. That is materially more than a size-5 slice — re-sized **5 → 8**. Carry-forward reason: **outgrew**.

**Recommend `/split` into two independently-batchable per-configurator slices** (no inter-dependency — separate files/routes): (a) Intent Configurator → FUI radio/text-field (+ retain custom-value CRUD); (b) Technical Configurator → FUI text-field/number/radio/droplist + NL box + verdict. Each is then a focused, verifiable slice. No new design fork (the dogfood target + #1286 controls are ratified). Released to `open`.
