---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-06"
tags: [jsx, adapters, docs]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Reconcile the JSX Adapter standard page with the mirror-dialect decision and the built transform

> **Resolved 2026-06-06.** `src/_includes/adapter-descriptions/jsx-adapter.njk` now leads with the
> "Authoring model — a mirror of HTML, not React" section, foregrounds the feature-mapping table and the
> working build-time transform, treats the literal `<template is="…">` element as canonical (with
> `<For>`/`<Show>`/`<Resource>` marked as equivalent/deferred sugar), and links the playground demo. (Restored
> from a delete-on-complete commit and renumbered to 112.) Original narrative preserved below.

`src/_includes/adapter-descriptions/jsx-adapter.njk` still presents `<For>`/`<Show>`/`<Resource>` as the canonical JSX directive components and "advertises" `jsxToHtml`/`htmlToJsx` as if unbuilt — both now out of step with reality: the mirror-dialect decision makes literal `<template is="…">` canonical, and the transforms exist (`blocks/renderers/jsx/htmlToJsx.ts`, `jsxToHtml.ts`).

Align the page with the feature-mapping report: foreground the mapping table and the working build-time conversion, mark the pretty directive components as deferred sugar (see the `jsx-directive-sugar` item), and link the playground demo. An "Authoring model" section was already added at the top; the rest of the page needs the same treatment.
