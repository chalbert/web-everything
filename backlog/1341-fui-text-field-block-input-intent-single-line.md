---
kind: story
size: 3
parent: "1286"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/text-field/"
tags: []
---

# FUI text-field block — input intent (single-line)

Greenfield fui:blocks/text-field/ single-line CustomElement implementing the input intent (variant/affordances/status, label/error a11y); unit+e2e tests; fui:src/_data/blocks.json entry (#784 gate); demo. locus: frontierui.

## Progress (2026-06-20, batch-2026-06-20-1344-1342)

Built on the FUI block factory pattern (config factory + `mountInDocument` mode-C, no registered tag —
#841 open):

- `fui:blocks/text-field/TextField.ts` — `createTextField` returning a `TextFieldHandle`
  (`getValue`/`setValue`/`setStatus`). **Variants** text/email/password/search/tel/url, leading/trailing
  **affordances** (`prefix`/`suffix`, `aria-hidden`), **status** default/error/success/warning with a
  described-by message. A11y: real `<label for>` ↔ `<input id>`, `aria-describedby` to the status message,
  `aria-invalid` on error, `aria-required` + visible marker on required. Exported `TEXT_FIELD_CSS`.
- `fui:blocks/text-field/index.ts` — barrel.
- `fui:blocks/__tests__/unit/text-field/TextField.test.ts` — **10 tests** (label/id association, variant,
  affordances, required wiring, error describedby+invalid, default no-describedby, `setStatus` re-wire,
  value round-trip + callbacks, disabled/readonly, mode-C mount/teardown). All green.
- `fui:src/_data/blocks.json` — `text-field` entry (#784 gate); `fui:demos/text-field-demo.html`
  (auto-registered, `demoFile` resolves).

Gate: adds cleanly (44 blocks / 44 demos, no text-field finding); the 2 residual errors are the
pre-existing `notification`/`signature-pad` manifest gaps (not this changeset).
