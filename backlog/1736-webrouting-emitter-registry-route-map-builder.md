---
kind: story
size: 3
parent: "1684"
status: open
blockedBy: ["1721", "1725"]
dateOpened: "2026-06-24"
relatedReport: reports/2026-06-24-backlog-split-analysis.md
tags: []
---

# webrouting emitter registry + route-map builder

we:webrouting — the foundational emitter slice graduated from #1688. Build the default-less pluggable emitter REGISTRY (an open set the project config extends; new emitters join without a decision) plus the DOM→map BUILDER that #1721 parked for the first consuming slice: run parseRouteDefinitions() (we:blocks/router/types.ts:194) over RouteDefinition[], drop the non-serializable pattern + template, emit the serializable routes[].path map every emitter reads. Ships derivation + foundational conformance vectors (WE holds the contract; browser-runtime impl rides downstream to FUI). Blocked by the projection schema (#1721) + project skeleton (#1725). Codified in #faithful-derivation-exclude-not-fabricate.
