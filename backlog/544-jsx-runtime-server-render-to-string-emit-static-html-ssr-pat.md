---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-14"
tags: []
---

# jsx-runtime server render-to-string emit (static-HTML SSR path)

FUI-core capability carved from the #425 ruling: @frontierui/jsx-runtime currently only builds light DOM at runtime (JSXRenderer.createElement) with no server string-emit. Add a render-to-string path so the same HTML-mirror JSX primitives can server-render to static HTML — the enabling capability for static-first islands. Separable from the webdocs-ui primitives and reusable by #424's webdocs generator output. Prerequisite for #512 (the webdocs-ui primitives build) and thus the whole self-host Web Docs UI floor (#398/#091).
