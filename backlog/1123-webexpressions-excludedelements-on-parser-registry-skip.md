---
type: idea
workItem: story
size: 3
parent: "1096"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webexpressions: excludedElements on parser + registry skip

Add optional excludedElements:string[] to we:plugs/webexpressions/CustomTextNodeParser.ts:34-52 and skip parsing text whose ancestor localName is excluded in we:plugs/webexpressions/CustomTextNodeRegistry.ts:183-241 (spec we:src/_includes/project-webexpressions.njk:181-196). Demo: unit, {{x}} inside <code> renders literally, outside interpolates.
