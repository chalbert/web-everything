---
type: decision
status: open
dateOpened: '2026-06-03'
tags:
  - webcomponents
  - component
  - adapters
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /adapters/declarative-component/, label: Declarative Component adapter }
---

# DC-6 — Decide the AST-transform adapter's placement

The build-time declarative→class transform overlaps the canonical HTML Adapter's "AST Transformation" remit. It currently lives as a standalone `declarative-component` adapter (in the syntax category, sibling to the functional-component-adapter) that cross-references the HTML Adapter. Current recommendation: keep it standalone for now so the `<component>` transform is independently discoverable. Alternative held open: fold it into the HTML Adapter once the surface stabilizes, to avoid fragmenting the AST-transformation story.
