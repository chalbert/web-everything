---
kind: story
size: 5
parent: "1975"
status: active
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
tags: []
---

# Build the error-boundary directive (comment boundary, live region + inert fallback)

Build the ratified error-boundary directive (#1978 GO) in FUI's webdirectives plug. Applies #1983's mixed form: live comment-bounded guarded region hosting a nested inert <template slot=fallback> stamped only when a render/connect error is caught in the region. Scope fence per #1978: existence-gating only (guarded-vs-fallback selection) — no error transformation or retry logic in markup. Register via the customNodes frame (#2074): the comment boundary is a CustomNode (CustomComment instance) per #1986. Pairs with async's catch (#1976) — async rejection vs this sync render error. Parent #1975; naming per #1987.
