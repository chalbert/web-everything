---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [jsx, adapters, directives]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Add the <For>/<Show>/<Resource> directive sugar layer for JSX

The mirror dialect canonicalizes directives as the literal `<template is="…">` element because it is the one form JSX can both express and reverse. The prettier `<For each>` / `<Show when>` / `<Resource>` components are **deferred sugar** that should map through the same directive registry to and from the `<template is>` form. Implement them now that the core transform is proven (`htmlToJsx`/`jsxToHtml`). See the feature-mapping report rows 7–8.

Distinct from `jsx-rendering-strategy-axis`: this is an alternative *syntax spelling* of the same directives, not a change to how trees update over time.
