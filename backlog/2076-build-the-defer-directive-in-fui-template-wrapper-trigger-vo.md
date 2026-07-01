---
kind: story
size: 5
parent: "1975"
status: open
blockedBy: ["1977"]
dateOpened: "2026-07-01"
tags: []
---

# Build the defer directive in FUI (template-wrapper, trigger vocab + prefetch)

Implement the ratified defer directive (#1977) in Frontier UI as a CustomTemplateType: <template type="defer"> wrapper hosting nested inert <template slot="placeholder|content"> branches, stamped one at a time. Support the full converged trigger vocab (on = idle | visible | interaction | hover | media:(...) | timer:5s) via IntersectionObserver / requestIdleCallback / matchMedia / event listeners / timer, plus optional prefetch (requestIdleCallback / Speculation Rules) to warm the content module/data before the trigger. Optional loading/error auxiliary slot templates per Angular @defer. Reuses the existing multiTemplate plumbing (switch / resource:loader). Registration via CustomTemplateType, never is=.
