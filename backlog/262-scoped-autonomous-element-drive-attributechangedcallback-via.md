---
type: issue
workItem: task
parent: "167"
status: open
blockedBy: ["228"]
dateOpened: "2026-06-10"
tags: []
---

# Scoped autonomous element: drive attributeChangedCallback via a setAttribute/MutationObserver patch

Add the missing setAttribute patch / MutationObserver and honour the real class's observedAttributes so a scoped autonomous element reacts to attribute changes. Sibling of #228 (legal construction first). Flips the attributeChanged guard in plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts.
