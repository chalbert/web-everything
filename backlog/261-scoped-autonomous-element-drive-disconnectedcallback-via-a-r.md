---
type: issue
workItem: task
parent: "167"
status: open
blockedBy: ["228"]
dateOpened: "2026-06-10"
tags: []
---

# Scoped autonomous element: drive disconnectedCallback via a removal-path patch

Patch the DOM removal path (removeChild/remove, and the disconnect half of replaceChildren) so removing a scoped autonomous element fires disconnectedCallback — no listener/effect leak. Sibling of #228 (which makes scoped construction legal first). Flips the disconnect guard in plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts.
