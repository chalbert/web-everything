---
kind: story
locus: plateau-app
size: 3
parent: "402"
status: resolved
blockedBy: ["442"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/platform-manager/contract-drift.ts
tags: [plateau, plateau-app, contract-drift, conformance, seam-contract, platform-manager]
relatedProject: webregistries
crossRef: { url: /backlog/402-plateau-platform-manager-product-graph-aggregation-impact-an/, label: "Platform-manager product epic (#402)" }
---

# Contract-drift detection — provider tier vs consumer projection across teams

plateau-app slice of #402. Over the #442 aggregated model, compare each provider's capability tier against the consumer's consumerRequires projection (the seam-contract from #401) and flag subset-containment violations — cross-team contract drift caught before it breaks. Independent of impact-analysis; both read the aggregated graph. Licensed platform-manager product (#092).
