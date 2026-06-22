---
kind: task
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# FUI text-node registry: skip needless replaceWith for static-only text segments

In fui:plugs/webexpressions/CustomTextNodeParser.parse(), a text run with no delimiters returns a FRESH new Text(remaining), so CustomTextNodeRegistry.#upgradeTextNode replaceWith()-swaps every static/whitespace text node with an equal one on each upgrade — pointless DOM churn (and it was the proximate trigger of the #1207 TreeWalker-abort, now fixed structurally by snapshotting nodes before mutating). Cleanup: when the parse yields a single node equal to the original (or skip replace when determinedTextNodes deep-equals [element]), leave the node in place. Pure efficiency/clarity; behavior already correct after #1207.

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

Added an `isStaticNoOp` guard in `CustomTextNodeRegistry.#upgradeTextNode`
(`fui:plugs/webexpressions/CustomTextNodeRegistry.ts`), applied in **both** the connected and
not-connected branches: when the parse result is a single plain `Text` (not a `CustomTextNode`) whose
`textContent` equals the original element's, return early — no `replaceWith`. This is the deep-equal-`[element]`
case the card describes; the parser handing back a fresh equal `Text` previously defeated the existing
`!== element` identity guard and churned the DOM on every upgrade. Fixed at the registry (it has both the
original node and the parse result) rather than `parse()` (which only sees a string, never the live node).

**Tests:** added a focused identity assertion to
`fui:plugs/webexpressions/__tests__/unit/CustomTextNodeRegistry.excludedElements.test.ts` — a
`<code>{{ name }}</code>` static run keeps the **same** `Text` instance across `upgrade()` (would fail
pre-fix, since the fresh Text would replace it). Full webexpressions suite **105 pass / 2 skipped**;
`check:standards` (frontierui) green. No behavior change — pure efficiency, as scoped.
