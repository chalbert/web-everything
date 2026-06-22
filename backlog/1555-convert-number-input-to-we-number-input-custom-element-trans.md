---
kind: story
size: 2
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "@frontierui/blocks/number-input/NumberInputElement.ts"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-2.md
tags: [packaging, custom-elements, block-model, conversion, number-input, frontierui]
---

# Convert number-input to we-number-input custom element (transient A)

Register the number-input block as a `we-number-input` custom element via the transient (A) mechanism, mirroring the shipping reference at `fui:blocks/transient/TransientElement.ts`. A single form control erases to a real native `<input>` (native form participation / a11y), so it takes mechanism **A** per [#1456](/backlog/1456-grouped-form-control-packaging-mechanism-transient-a-vs-pers/) fork-2 (single form-control shape → A, ~90%) and the #1381 packaging guideline (`we:docs/agent/block-standard.md` §7). Flat application, no fork.

Wave-3 of the [#1442](/backlog/1442-block-model-conversion-register-remaining-blocks-as-custom-e/) block-model conversion, carved off the single-input arm deferred in `we:reports/2026-06-22-1442-slice-wave-2.md`. Independent of #1554 (text-field); both batchable in one lane.

## Resolved (batch-2026-06-22-1545-1549)

`fui:blocks/number-input/NumberInputElement.ts` (extends `TransientElement`, resolveTag → `div`, decorate →
`createNumberInput` adopt) + `fui:blocks/number-input/registerNumberInput.ts` (`we-number-input`), barrel
exports, and bootstrap registration (`fui:plugs/bootstrap.ts`) mirroring the #1554 text-field sibling. 4
happy-dom unit tests green (`fui:blocks/__tests__/unit/number-input/NumberInputElement.test.ts`); frontierui
`check:standards` 0 errors. Flat application, no fork.
