---
type: issue
workItem: task
parent: "048"
status: open
dateOpened: '2026-06-08'
tags:
  - webcomponents
  - component
  - transform
  - shadow-dom
  - correctness
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /adapters/declarative-component/, label: Declarative Component Adapter }
---

# `component-transform`: `shadow="closed"` lowering silently re-attaches on reconnect

The frontierui byte-identical transform (`frontierui/compiler/src/component-transform/imperative.ts`,
built in #048) emits a single canonical class body for `open`/`closed`:

```js
const root = this.shadowRoot ?? this.attachShadow({ mode: '<mode>' });
if (!root.childNodes.length) root.append(TEMPLATE.content.cloneNode(true));
```

This is correct for `shadow="open"` (the only shadow-bearing fixture so far — `x-empty`). It is **wrong
for `shadow="closed"`**: a closed root is *not* readable via `this.shadowRoot`, so on every reconnect
`this.shadowRoot` is `null`, `attachShadow` runs again, and the second call throws (`NotSupportedError`).
The webeverything runtime twin (`blocks/renderers/component/declarativeComponent.ts`) already solved this
with a private `#root = this.shadowRoot;` field cached at construction; the frontierui canon diverged to
the simpler `const root` form, which only holds for `open`.

This is a defect-in-waiting, not a live bug: there is no `closed` fixture yet, so nothing emits the broken
form today. It will surface the moment a `closed` round-trip fixture lands during "grow fixtures one paired
rule at a time."

## What to do

- When the first `shadow="closed"` fixture pair is authored, switch the shadow-bearing lowering to the
  `#root`-field shape (or another form that survives reconnect for closed roots), and pin both the
  `closed` and the existing `open` fixtures so the round-trip stays byte-identical for each.
- Decide whether `open` keeps the terser `const root` form or unifies on the `#root` field — unifying is
  simpler to reason about but changes the existing `x-empty` canonical bytes (a fixture rewrite, fine since
  this repo owns its own canon).

## Progress
- **Status:** open — surfaced during #048 close-out (2026-06-08). No `closed` fixture exists yet, so the
  gap is latent; fix it together with the first `closed` fixture.
