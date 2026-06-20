---
kind: story
size: 3
parent: "1286"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/number-input/"
tags: []
---

# FUI number-input block — input intent

Greenfield fui:blocks/number-input/ CustomElement (`<input type=number>`/spinner + Intl-aware) implementing the input intent (variant/status); unit+e2e tests; fui:src/_data/blocks.json entry (#784 gate); demo. locus: frontierui.

## Progress (2026-06-20, batch-2026-06-20-1344-1342)

Built on the FUI block factory pattern (config factory + `mountInDocument` mode-C, no registered tag —
#841 open):

- `fui:blocks/number-input/NumberInput.ts` — `createNumberInput` returning a `NumberInputHandle`
  (`getValue`/`setValue`/`getFormatted`/`setStatus`). Native `<input type=number>` with `min`/`max`/`step`
  + `inputMode=decimal`, explicit **−/+ spinner buttons** that step and **clamp** to `[min,max]`,
  on-commit clamp of typed out-of-range values, and an **`Intl.NumberFormat`-aware** aria-live read-out
  (currency/percent/decimal per `locale`+`formatOptions`). Status default/error/success/warning with
  `aria-invalid` + composite `aria-describedby` (read-out + message), `<label for>` a11y, aria-labelled
  steppers. Exported `NUMBER_INPUT_CSS`.
- `fui:blocks/number-input/index.ts` — barrel.
- `fui:blocks/__tests__/unit/number-input/NumberInput.test.ts` — **11 tests** (native attrs, getValue/null,
  stepper step+clamp, stepper a11y labels, Intl currency format, setValue clamp+readout, typed-range clamp,
  error describedby+invalid, setStatus toggle, disabled cascade, mode-C mount/teardown). All green.
- `fui:src/_data/blocks.json` — `number-input` entry (#784 gate); `fui:demos/number-input-demo.html`
  (auto-registered, `demoFile` resolves).

Gate: adds cleanly (45 blocks / 45 demos, no number-input finding); the 2 residual errors are the
pre-existing `notification`/`signature-pad` manifest gaps (not this changeset).
