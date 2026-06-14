---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["544"]
dateOpened: "2026-06-14"
tags: []
---

# Build the @frontierui/webdocs-ui self-host primitives per #425 ruling

The build #425 decided: ship @frontierui/webdocs-ui — a single published package of static-first Web Docs primitives (page shell, nav, protocol/conformance panels) authored as JSX on @frontierui/jsx-runtime, server-rendered to static HTML via the #544 string-emit path, with interactivity supplied by composing the existing FUI behavior blocks (tabs, navigation, droplist, for-each) as light-DOM islands (hydrate-optional, degrades to static HTML JS-off). The load-bearing cancel-and-self-host floor from the #091 ruling. Reference impl is WE's own /protocols/ + capabilityMatrix render, generalized into reusable FUI parts. Consumed by the plateau-app served product (#427) and by self-hosters via npm install + assemble-the-shell.
