---
type: issue
workItem: task
parent: "048"
status: resolved
blockedBy: ["048"]
dateOpened: '2026-06-08'
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
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

The frontierui byte-identical transform (`fui:frontierui/compiler/src/component-transform/imperative.ts`,
built in #048) emits a single canonical class body for `open`/`closed`:

```js
const root = this.shadowRoot ?? this.attachShadow({ mode: '<mode>' });
if (!root.childNodes.length) root.append(TEMPLATE.content.cloneNode(true));
```

This is correct for `shadow="open"` (the only shadow-bearing fixture so far — `x-empty`). It is **wrong
for `shadow="closed"`**: a closed root is *not* readable via `this.shadowRoot`, so on every reconnect
`this.shadowRoot` is `null`, `attachShadow` runs again, and the second call throws (`NotSupportedError`).
The webeverything runtime twin (`we:blocks/renderers/component/declarativeComponent.ts`) already solved this
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
- **Status:** resolved (2026-06-10, in a batch). Fixed in frontierui.
- **Done:**
  - `fui:compiler/src/component-transform/imperative.ts` — `emitImperative` now lowers both `open` and
    `closed` to the reconnect-safe `#root`-field shape: a `#root;` field plus
    `this.#root ??= this.attachShadow({ mode })` and `if (!this.#root.childNodes.length) this.#root.append(…)`.
    The old `const root = this.shadowRoot ?? this.attachShadow(…)` form re-attached on every reconnect for
    closed roots (closed roots are unreadable via `this.shadowRoot`) and the second `attachShadow` threw.
    Chose to **unify `open` onto the same shape** (per the second decision above) — one form is simpler to
    reason about; the doc comment was updated to match. `shadow="none"` (light DOM) is unchanged.
  - Authored the first `closed` fixture pair (`fui:x-shadow-closed.html` / `.ts`) and rewrote the existing
    `fui:x-empty.ts` open fixture to the new bytes; registered a `contract('x-shadow-closed', …)` in
    `fui:transform.test.ts`. The `parseImperative` AST walk already keyed only on the `attachShadow` call, so
    `toDeclarative` needed no change.
  - Gate: full frontierui suite green — 1342 passed / 7 skipped (88 files); the transform contract suite
    grew 8 → 12 (the closed pair's four byte-identical round-trip assertions).
