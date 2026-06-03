---
type: idea
status: active
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
