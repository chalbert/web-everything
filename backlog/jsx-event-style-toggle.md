---
type: decision
status: open
dateOpened: '2026-06-03'
tags:
  - jsx
  - adapters
  - events
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# JSX adapter — support both event spellings behind a UI toggle

The JSX mirror dialect supports two spellings of the same handler: the canonical/reversible **string behavior** `on:click="inc($event)"` and the convenience **function prop** `onclick={inc}`. A **named** handler round-trips between them (the function name is the string path the injector resolves); an **inline closure** `onclick={() => …}` has no string path and is one-way. The user wants both available, with a UI sub-toggle on the source toggle to switch which spelling is displayed.

**Current recommendation:** author function-style now (it's the natural JSX ergonomics), treat the string form as the canonical layer the AST transform targets, and add the string⇄function *display* toggle once authored pairs or the live transform exist. The transform synthesizes a handler name (or flags lossy) for inline closures. **Alternative held open:** make string-style canonical for authoring too, sacrificing the type-checked-function ergonomics that are JSX's main draw.

Gated on the Axis-1 slice (feature-mapping table + `source-toggle.njk` + the realigned renderer). See the mapping report row 5 and the parked `jsx-rendering-strategy-axis`.
