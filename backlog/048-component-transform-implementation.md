---
type: idea
status: open
dateOpened: '2026-06-03'
tags:
  - webcomponents
  - component
  - adapter
  - transform
  - ast
  - poc
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /adapters/declarative-component/, label: Declarative Component Adapter }
---

# Implement the bidirectional `<component>` ↔ class AST transform (POC)

POC build of the deterministic, bidirectional transform between `<component>` declarative source and its lowered `class extends HTMLElement` form. Implementation in `frontierui/compiler/src/component-transform/`; tests pin a byte-identical round-trip contract both directions, so AST library and runtime location stay swap-able. First fixture (`x-empty`) and 4 red tests already in place; next session picks the AST library at first-test-green and grows fixtures one paired rule at a time.

## Progress
- **Status:** open — POC scaffolding only; not yet implemented. Verified 2026-06-06 in `frontierui/compiler/src/component-transform/`: `transform(source, direction)` still `throw new Error('component-transform: not implemented')`; `types.ts` defines the contract; the only fixture is `__tests__/component-transform/fixtures/x-empty.{ts,html}` with `transform.test.ts` red by design.
- **Note (no overlap with #076):** the actual `<component>` ↔ class lowering that shipped lives in *webeverything* (`blocks/renderers/component/declarativeComponent.ts`, exercised by #076). This item is the separate *frontierui AST-library, byte-identical round-trip* compiler — still greenfield.
- **Next:** pick the AST library, get `x-empty` to green both directions, then grow fixtures one paired rule at a time.
