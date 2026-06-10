---
type: issue
workItem: task
parent: "167"
status: open
blockedBy: ["228"]
dateOpened: "2026-06-10"
tags: []
---

# Scoped autonomous element: drive form-associated callbacks

Carry static formAssociated=true onto the natively-registered class so the browser associates a scoped element and fires formResetCallback/formStateRestoreCallback/formDisabledCallback. Sibling of #228 (legal construction first). Flips the form-reset guard in plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts.
