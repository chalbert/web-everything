---
kind: story
size: 5
status: open
blockedBy: ["1818"]
dateOpened: "2026-06-27"
tags: []
---

# SSR injector-context hydration: seed the webexpressions injector chain from server-rendered state

A general capability surfaced by #1818: an attribute web-expression (`rows="[[ @ctx ]]"`) resolves against the webexpressions injector chain, but on a server-rendered, no-per-element-JS surface that context is empty until JS boots. This card defines how an injector-chain context is seeded (hydrated) from server-rendered state so declarative [[ ref ]] bindings have something to resolve against on upgrade. General to every block's declarative-binding form, not data-table-specific. Blocks the complex/interactive SSR data-table path (#1787 / #1600 family); the simple-table path ships without it.
