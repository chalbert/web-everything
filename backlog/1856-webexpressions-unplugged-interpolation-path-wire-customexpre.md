---
kind: story
size: 5
parent: "1836"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/plugs/expressionsUnplugged.ts
tags: []
---

# webexpressions unplugged interpolation path — wire customExpressionParsers/textNodeParsers/textNodes without bootstrap + e2e binding test

Re-audit #1840 found the headline webexpressions capability (`{{ }}`/`[[ ]]` interpolation) has no unplugged path: binding needs customExpressionParsers/customTextNodeParsers/customTextNodes set on a document injector, which fui:plugs/bootstrap.ts:195-221 builds but fui:plugs/unplugged.ts never does. Build an unplugged way to wire those registries (an unplugged-injector or injector-less seam) and an end-to-end interpolation-binding test. Locus: FUI. See we:reports/2026-06-27-unplugged-functional-re-audit.md.

## Shipped (batch-2026-06-27-1842-1720)

Chose the **unplugged-injector seam** (the injector-less option was ruled out: `customExpressionParsers`,
`customTextNodes`, and `customContexts:<name>` all resolve via the **injector chain**
`InjectorRoot.getProviderOf`; only `customTextNodeParsers` reads `window`).

- **Seam:** `fui:plugs/expressionsUnplugged.ts` — `setupExpressionsUnplugged(root = document)` mirrors the
  webexpressions subset of `fui:plugs/bootstrap.ts` (~182-225) with **no prototype patches**: builds the
  expression-parser registry (value/pipe/call, in that order), the text-node-parser registry
  (mustache=`{{ }}`, polymer=`[[ ]]`), and the text-node registry (both → `InterpolationTextNode`); attaches
  an `InjectorRoot` to `root` and `.set()`s all three on the document injector; sets `window.customTextNodeParsers`
  (+ `window.customTextNodes`); returns the text-node registry so the caller controls `upgrade(subtree)`.
- **e2e binding test:** appended to `fui:plugs/webexpressions/__tests__/unit/webexpressions.unplugged.test.ts` —
  builds real DOM `{{ name }}` / `[[ name ]]`, wires the seam, provides the context (`customContexts:state =
  { name: 'World' }` — a bare identifier parses as a `state` reference), upgrades, and asserts **both**
  delimiters render `World`. A **wiring-guard** test proves the assertion is non-trivial: without the seam the
  text stays raw `{{ name }}` / `[[ name ]]`.

Gate: `npx vitest run` on the new test → **5 passed** (3 pre-existing + 2 new); the new files
are tsc-clean (the 2 pre-existing `fui:plugs/webexpressions/UndeterminedTextNode.ts` + `fui:plugs/webstates/CustomStorageStrategyRegistry.ts`
tsc errors are unrelated). Implementation delegated to a Sonnet sub-agent; seam + test reviewed and the gate
re-run on the main loop. (One test-env adaptation: `upgrade()` is called per-span because happy-dom's
`createTreeWalker(SHOW_TEXT)` doesn't traverse grandchildren — the seam itself is unaffected.) Unblocks the rest
of the #1836 unplugged-functional epic that depends on a working interpolation path.
