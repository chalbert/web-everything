---
kind: story
locus: plateau-app
size: 3
parent: "402"
status: resolved
blockedBy: ["442"]
dateOpened: "2026-06-12"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/platform-manager/impact-analysis.ts
tags: [plateau, plateau-app, impact-analysis, dependency-graph, platform-manager]
relatedProject: webregistries
crossRef: { url: /backlog/402-plateau-platform-manager-product-graph-aggregation-impact-an/, label: "Platform-manager product epic (#402)" }
---

# Impact analysis — if I change X, who breaks

plateau-app slice of #402. Blast-radius traversal over the #442 aggregated provider-consumer model: given a change to a provider capability, surface every downstream consumer that breaks. Reads the aggregated graph; independent of the other analyses/surfaces. Part of the licensed platform-manager product (#092 ruling).
