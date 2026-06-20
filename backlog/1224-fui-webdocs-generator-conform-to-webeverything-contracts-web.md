---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["1223"]
relatedProject: webdocs
locus: frontierui
dateOpened: "2026-06-20"
tags: [webdocs, generator, conformance]
---

# FUI webdocs generator — conform to @webeverything/contracts/webdocs + implement declarative strategy vocabulary interpretation + imperative escape-hatch (degrade-loudly)

Implement the reference-impl side of the ratified #1163 Doc Spec contract: conform fui:webdocs/generator.ts to @webeverything/contracts/webdocs (pass the golden vectors for the default path + declarative vocabulary), implement the declarative strategy vocabulary interpretation (order/group/sort-by-field), and add the per-implementer imperative escape hatch (e.g. a JS SortStrategy) with the degrade-loudly rule (declare non-support / fall back to the declarative default, never silently differ). FUI is the reference implementer, not the engine. Blocked on the WE contract slice (#1223).
