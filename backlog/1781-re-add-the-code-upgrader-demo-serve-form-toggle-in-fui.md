---
kind: task
status: resolved
blockedBy: []
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
tags: []
---

# Re-add the code-upgrader demo serve() form-toggle in FUI

The FUI code-upgrader demo (relocated in #1777) renders the full upgrade pipeline + live element, but intentionally omits the WE demo's MaaS serve() form-toggle (the 'served in any form' pane), because serve() is still WE-resident. Once #1730 relocates the MaaS serving runtime to FUI, re-add the form-toggle to fui:demos/code-upgrader-demo.ts (the livePane() helper) so the FUI demo regains full parity with the original WE demo.

## Progress (batch-2026-06-26-1745-1775)

Stale-premise correction: #1730 did **not** relocate the MaaS serve runtime to FUI — it **withdrew**
`serve()` from WE entirely (impl→FUI under #1282/#1771), and `serve(DEF, form)` was only ever a thin
wrapper over the canonical source generators (`serve()===generateClassSource(parseDefinition(DEF))`, per
#1775's note). So rather than resurrect the deleted resolver, the "served in any form" toggle is re-added
directly over FUI's own generators (forward-migration; no live consumer of the old serve()):
- `fui:demos/code-upgrader-demo.ts` — `livePane()` regains the form-toggle: declarative `<component>` /
  JS `class` (`generateClassSource`) / `functional` (`generateFunctionalSource`) — the same three forms a
  MaaS origin serves, off the FUI kernel that now owns them. Live-element render unchanged.
- `fui:demos/code-upgrader-demo.css` — `.serve-toggle` / `.serve-form` tab styling.

Full parity with the original WE demo restored. FUI `check:standards` baseline-steady (34 pre-existing
errors in the in-flight component-relocation churn, none in this changeset).
