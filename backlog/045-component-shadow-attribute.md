---
kind: decision
size: 1
parent: "049"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: '2026-06-03'
dateResolved: '2026-06-08'
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

**Ratified 2026-06-08 — recommendation adopted.** Keep `shadow="open|closed|none"`, documented as mapping onto `attachShadow` / Declarative Shadow DOM. The shorter spelling plus the light-DOM (`none`) case DSD can't express wins for authoring; the `shadowrootmode` mirror is held as a possible future alias if 1:1 platform familiarity proves to matter.
