---
type: idea
workItem: story
size: 5
parent: "398"
status: resolved
blockedBy: ["424", "545"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "plateau-app/src/web-docs/served-site.ts (mountWebDocs: #424 generateDocsSite + #425/#545 webdocs-ui Nav/ConformancePanel) — served docs site + per-customer conformance dashboard, open-core FREE tier"
tags: [webdocs, plateau, plateau-app, conformance, open-core, product-build]
relatedProject: webdocs
crossRef: { url: /backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/, label: "Web Docs product epic (#398)" }
---

# plateau-app served Web Docs site + per-customer conformance report

plateau-app slice of #398 — the tested, hosted product per the #091 ruling. Serve a customer's generated docs site (from the #424 generator) assembled with the #425 primitives, plus their per-customer conformance/coverage dashboard — the parameterized-per-customer generalization of WE's static capabilityMatrix (reuse the /protocols/ pattern, Fork 2). This is the open-core FREE tier; usage-based paid tiering is a separate decision-gated slice. Blocked on the generator (#424) and primitives (#425). May later sub-split served-site vs conformance-report.
