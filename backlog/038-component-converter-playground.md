---
type: idea
workItem: story
size: 3
parent: "049"
status: open
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

# Author the `<component>` converter playground page

A standalone demo page at `demos/converter.html` — two-pane bidirectional editor over the `<component>` ↔ class transform, fixture picker for supported features, and inline named-rule errors for unsupported syntax. Shares its fixtures with the test suite in `frontierui/compiler/__tests__/component-transform/fixtures/` so it can't drift from what passes. Stands up once the first fixture (`x-empty`) goes green; requires a WE→FUI symlink mechanism for hot refresh.
