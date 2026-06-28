---
kind: story
size: 3
parent: "1294"
status: resolved
blockedBy: ["1915"]
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: "fui:plugs/webanalytics/analyticsConformance.ts"
tags: []
---

# analytics conformance binding (predicate over call log) + WE vector corpus

Slice 2 of the analytics relocation cascade (#1294). Write the one-screen analytics conformance binding that drives fui:analytics and observes the recorded-call log (the provider methods return void), plus its WE vector corpus in we:conformance-vectors/. Per #1816: predicate matcher over the observed log (routing / swap-reroute / arg-order / absence / count) via the shared #1847 mechanism. Mirrors webpolicy W2 (#1800).
