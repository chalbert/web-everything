---
kind: story
size: 2
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/expression-parser-playground.html"
tags: []
---

# Author + host FUI demos for the webexpressions parser blocks (handler-expression, double-curly, double-square)

Author demos for handler-expression-parser, double-curly-bracket-parser and double-square-bracket-parser (reuse the text-interpolation-demo pattern: input expression → parsed output) and wire demoFile. Slice of #972; locus frontierui.

## Progress — done in batch-2026-06-18

Authored one combined live demo `fui:demos/expression-parser-playground.html` (reuses `fui:demos/playground.css`),
three interactive sections — type an expression, watch the real parser split it live:
- **double-curly `{{ }}`** + **double-square `[[ ]]`** — `parse()` → static-text vs expression segments
  (`UndeterminedTextNode`), rendered as chips.
- **handler-expression** — `createHandlerExpressionParser().parse()` → handler name + typed args
  (`magic`/`context`/`state`/`literal`).

Wired `demoFile` → `fui:demos/expression-parser-playground.html` on all three blocks in `fui:src/_data/blocks.json`
(so #971's slot renders it) and removed them from the `DEMO_PENDING` allowlist in `fui:scripts/check-standards.mjs`
(the #973 completeness gate). **Verified live on :3001 via Playwright**: correct segmentation, `save($event,
@item.id, count, 'draft')` → `[magic, context, state, literal]`, 0 console errors. FUI check:standards green.

> Note: anchored `demoFile` (> `fui:demos/`, so a fragment dangles — dropped the anchors; the slot shows the whole 3-section playground.
