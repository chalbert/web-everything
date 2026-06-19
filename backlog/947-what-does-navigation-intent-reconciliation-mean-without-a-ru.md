---
type: decision
workItem: story
size: 3
status: parked
dateOpened: "2026-06-18"
locus: webeverything
relatedProject: webdocs
relatedItem: "934"
tags: [intents, conformance, traits]
---

# What does navigation-intent reconciliation mean without a runtime conformance gate

Carved out of #934 (could-not-split slice g). WE's intent→conformance is build-time only (we:webtraits/intentProfileResolver.ts); no runtime conformance gate exists, so 'reconcile the navigation intent meaningfully' would either fake a tie (forbidden) or silently expand into building a runtime gate (separate epic). Decide: build the runtime intent-conformance gate, or rule intent-reconcile out of #934's scope. Parked pending appetite. #934's done-when does not require it.
