---
kind: decision
status: open
blockedBy: []
dateOpened: "2026-07-01"
tags: []
---

# Does the FUI docs-website surface belong split from the FUI implementation, mirroring #2006?

Parallel to #2006 (which split the WE-website product from the WE-standard). Frontier UI has the same intermingling: an 11ty+Vite docs-site render (fui:.eleventy.js, fui:vite.config.mts, fui:_site, fui:webdocs) living inside what is otherwise the reference-implementation library repo. Open question: is the FUI docs-site a product surface that should be extracted to its own product-tier home (mirroring #2006 Fork 1a), or is a docs-site legitimately co-located with the library it documents (FUI, unlike WE, is allowed to hold runtime, so the rule-1 zero-impl argument does not transfer directly)? The distinguishing test is product-vs-render, not impl-vs-contract. Prepare: survey how peer impl libraries home their docs sites, state the fork, set a default. Related to #2006; does not block it.
