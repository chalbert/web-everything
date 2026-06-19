---
type: idea
workItem: story
size: 3
parent: "1098"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webdirectives: default CustomCommentParser + CustomCommentParserRegistry

New we:plugs/webdirectives/CustomCommentParserRegistry.ts extends we:plugs/core/CustomRegistry.ts (localName customCommentParsers) + a default parser for the namespaced grammar (spec we:src/_includes/project-webdirectives.njk:258-289); mirror we:plugs/webexpressions/CustomExpressionParserRegistry.ts:181. Pure string parsing, no DOM. Demo: unit parses namespace:name + options and recognizes the closing marker.
