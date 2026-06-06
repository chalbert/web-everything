---
type: decision
status: open
dateOpened: "2026-06-06"
tags: [jsx, adapters, demos]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Migrate or retire the old declarative-spa-jsx demo

`demos/declarative-spa-jsx.{html,tsx}` predates the mirror-dialect decision: it is React-flavored
(uses `className`, function event handlers throughout) and is **not registered** in
`src/_data/demos.json`, so it is unsurfaced and out of step with the JSX adapter's current conventions.

Decide its fate: either **migrate** it to the mirror dialect (`class`, `on:*` string behaviors,
`bind-*`) and register it as a proper demo, or **retire** it as superseded by the
`jsx-adapter-demo` playground. Leaving it as-is risks a future reader treating React-flavored JSX as
the supported style.
