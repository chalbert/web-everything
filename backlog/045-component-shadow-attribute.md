---
type: decision
status: open
dateOpened: '2026-06-03'
tags:
  - webcomponents
  - component
  - shadow-dom
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-2 — Decide the shadow-mode attribute spelling

Native Declarative Shadow DOM spells it `shadowrootmode`. The `<component>` element currently uses `shadow="open|closed|none"` — shorter, and it adds the light-DOM (`none`) case that DSD has no word for. Current recommendation: keep `shadow="open|closed|none"`, documented as mapping onto `attachShadow` / DSD. Alternative held open: mirror `shadowrootmode` verbatim for 1:1 platform familiarity.
