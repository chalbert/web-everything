---
kind: task
status: open
blockedBy: []
dateOpened: "2026-06-24"
tags: []
---

# Re-add the code-upgrader demo serve() form-toggle in FUI

The FUI code-upgrader demo (relocated in #1777) renders the full upgrade pipeline + live element, but intentionally omits the WE demo's MaaS serve() form-toggle (the 'served in any form' pane), because serve() is still WE-resident. Once #1730 relocates the MaaS serving runtime to FUI, re-add the form-toggle to fui:demos/code-upgrader-demo.ts (the livePane() helper) so the FUI demo regains full parity with the original WE demo.
