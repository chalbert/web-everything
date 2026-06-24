---
kind: story
size: 3
parent: "912"
status: open
blockedBy: ["1759"]
dateOpened: "2026-06-24"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot, functional-adapter, maas]
---

# Functional MaaS serve route — serve the live functional module cross-origin, keyed off caseId (sibling to wrapperServeHandler, not a wrapper-catalog member #1619)

Serve the #1759 live functional module over the existing cross-origin MaaS second origin (stood up by #1501, inheriting the #1556 CORS fix). A sibling route to fui:tools/maas/wrapperServeHandler.mjs, but keyed off caseId against we:src/_data/authorModeSource.json cases (NOT a wrapper-catalog ?form= member — #1619 keeps the functional id-space separate). Mirrors the wrapper endpoint #1029: content-identity + cache + error contract, with produceFunctionalBytes-live injected as the producer. Gives the workbench mount (#1746 chain) a cross-origin URL to import so the framework-free workbench (#955-B) never pre-bundles react into the main origin.
