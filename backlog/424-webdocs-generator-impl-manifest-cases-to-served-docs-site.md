---
type: idea
workItem: story
size: 5
parent: "398"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: webdocs/generator.ts
tags: [webdocs, frontier-ui, generator, conformance, product-build]
relatedProject: webdocs
crossRef: { url: /backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/, label: "Web Docs product epic (#398)" }
---

# webdocs generator impl — manifest+cases to served docs site

FUI slice of #398. Generalize this repo's build-time cases.js loader into a hostable serve-time webdocs generator: resolve a customer webmanifest+webcases pair and generate a docs site. Defines the webcases pivot that the incumbent-ingestion adapters target. Docs-as-code per the #091 ruling (Fork 1); resolver-input shape defaults to all-three (git repo / bundle / registry URL) behind one contract. Foundational FUI root, parallel with the self-host primitives slice.
