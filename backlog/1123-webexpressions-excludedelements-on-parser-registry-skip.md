---
kind: story
size: 3
parent: "1096"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webexpressions/CustomTextNodeParser.ts"
tags: []
---

# webexpressions: excludedElements on parser + registry skip

Add optional excludedElements:string[] to we:plugs/webexpressions/CustomTextNodeParser.ts:34-52 and skip parsing text whose ancestor localName is excluded in we:plugs/webexpressions/CustomTextNodeRegistry.ts:183-241 (spec we:src/_includes/project-webexpressions.njk:181-196). Demo: unit, `{{x}}` inside `<code>` renders literally, outside interpolates.

## Progress (resolved 2026-06-19)

- **we:plugs/webexpressions/CustomTextNodeParser.ts** — added the optional `excludedElements?: string[]` field (lower-cased tag names this parser skips; `undefined`/`[]` = parse everywhere, the most-flexible default), documented with the conventional set (`code`/`pre`/`script`/`style`/`textarea`) and the `customExpressions.upgrade(el)` opt-back-in.
- **we:plugs/webexpressions/CustomTextNodeRegistry.ts** — added `#isInsideExcludedElement(node, excludedElements)` (walks the text node's ancestor chain, case-insensitive `localName` match) and, in `#getParsedTextNodes`, **skip THIS parser** for a text node inside one of its excluded elements (other parsers with different exclusions still run — per-parser, not global).
- **we:plugs/webexpressions/__tests__/unit/CustomTextNodeRegistry.excludedElements.test.ts** — 4 green: `{{x}}` outside an excluded element renders interpolated (`parserName` set); inside `<code>` left literal; a deep descendant of `<pre>` skipped; no `excludedElements` parses even inside `<code>`.

Full webexpressions suite 99 green; whole-repo `check:standards` 0 errors.

**Note (pre-existing, out of scope):** the registry's tree walk only splits a text node that is a *direct child* of the `upgrade()` root — a `{{x}}` text node nested under a child *element* of the root is not split even on `main`. The tests therefore upgrade the host element directly (the realistic `customExpressions.upgrade(el)` surface the spec documents). The nesting limitation is unrelated to excludedElements and a separate fix if desired.
