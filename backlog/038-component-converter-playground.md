---
type: idea
workItem: story
size: 3
parent: "049"
status: open
blockedBy: []
dateOpened: '2026-06-03'
tags:
  - webcomponents
  - component
  - playground
  - docs
  - demo
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# Slice A — one-way `<component>` converter page (declarative→class)

A `frontierui/demos/` page (vite :3001) that converts `<component>` declarative source → its lowered
`class extends HTMLElement` form: a **fixture picker** over the sibling
`frontierui/compiler/__tests__/component-transform/fixtures/` (so it can't drift from what passes), a
**single output pane** showing the lowered class, and **inline named-rule errors** from the transform's
structured `errors` for unsupported syntax. No TS-in-browser — this direction uses only the minimal tag
reader.

- **Home (decided #700 → A):** lives in `frontierui/demos/` native. The bidirectional compiler is a pure
  frontierui artifact (impl → FUI); the page imports `../compiler/src/component-transform/index.js`
  directly and reads fixtures from the sibling `__tests__` dir — **no cross-repo import path, no drift
  surface.** New demo = drop a `.html`+`.ts` pair; the vite plugin auto-injects `/plugs/bootstrap.ts`.
- **Direction (light):** call `transform(source, 'toImperative')`
  ([`index.ts`](../../frontierui/compiler/src/component-transform/index.ts) → `parseDeclarative`
  regex tag reader + `emitImperative` string builder) — zero heavy deps. The reverse direction
  (`toDeclarative` via `parseImperative` → the full TS Compiler API) + the two-pane bidirectional editor
  is **slice B** (sibling under #049, blocked by this).
- **Fixtures:** enumerate the paired `.html`+`.ts` fixtures (`x-empty`, `user-card`, `x-shadow-closed`)
  from the sibling dir; render the chosen `.html` → lowered class, surface any `errors` inline.

**Demoable state:** `/component-converter` on :3001 — pick a fixture, see its lowered class output and any
named-rule errors.

Sliced from the original `story·13` via [`/split 038`](../reports/2026-06-15-backlog-split-analysis.md)
(post-#700 re-run). #038 already had `parent: 049`, so it was re-scoped in place to slice A (no nested
epic); slice B is a sibling under #049. WE docs surface this FUI-hosted demo via an iframe embed — its own
build item **#701**, not part of this page.
