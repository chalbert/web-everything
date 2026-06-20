---
kind: story
size: 3
parent: "1098"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webdirectives/CustomCommentParserRegistry.ts"
tags: []
---

# webdirectives: default CustomCommentParser + CustomCommentParserRegistry

New we:plugs/webdirectives/CustomCommentParserRegistry.ts extends we:plugs/core/CustomRegistry.ts (localName customCommentParsers) + a default parser for the namespaced grammar (spec we:src/_includes/project-webdirectives.njk:258-289); mirror we:plugs/webexpressions/CustomExpressionParserRegistry.ts:181. Pure string parsing, no DOM. Demo: unit parses namespace:name + options and recognizes the closing marker.

## Progress

Shipped the comment-directive parser layer:
- `we:plugs/webdirectives/CustomCommentParser.ts` — the `CustomCommentParser` contract
  (`parse(text) => { name, options } | null`) + `DefaultCommentParser` for the namespaced grammar
  (`namespace:directive-name option="v" …`, spec njk:258-289): extracts the `namespace:name` token,
  parses key/value options (`key="v"`/`'v'`/bare → coerced bool/number/string), returns `null` for a
  closing marker / empty / non-directive comment. `parseClosingMarker(text)` returns the name a
  `/namespace:name` closes. Pure string parsing, no DOM.
- `we:plugs/webdirectives/CustomCommentParserRegistry.ts` — `extends CustomRegistry`
  (`localName customCommentParsers`), `define(name, parser)` + `parse(text)` tries parsers in definition
  order (first match wins), mirroring `we:plugs/webexpressions/CustomExpressionParserRegistry.ts`.
  `createDefaultCommentParserRegistry()` pre-loads the default parser.
- `we:plugs/webdirectives/__tests__/unit/CustomCommentParser.test.ts` — 8 green (name+options, multi-line
  block, closing-marker/empty/non-directive → null, parseClosingMarker, registry order + custom-parser
  precedence, default factory).

Complements #1131's `CustomCommentRegistry` (which matches by `name`); WE `check:standards` 0 errors.
