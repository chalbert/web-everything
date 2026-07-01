---
kind: story
size: 5
parent: "1971"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: []
---

# Nested-directive parent-child lifecycle & ownership ordering

Promote fui:plugs/webdirectives/directiveInspector.ts nesting reconstruction from inspection to runtime: parent directives own nested children within their comment-marker boundaries, and connect/disconnect ordering cascades (parent connect -> children connect; reverse on teardown). Nesting tests land here. Document the marker convention to map onto DOM Parts ChildNodePart start/end (alignment note, not adoption). Slice A of #1971.
