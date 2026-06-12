---
type: idea
workItem: story
size: 5
parent: "402"
status: open
dateOpened: "2026-06-12"
tags: [plateau, plateau-app, dependency-graph, aggregation, platform-manager]
relatedProject: webregistries
crossRef: { url: /backlog/402-plateau-platform-manager-product-graph-aggregation-impact-an/, label: "Platform-manager product epic (#402)" }
---

# Cross-repo graph aggregator — provider-consumer graph into one live model

plateau-app slice of #402 (root). Consume the resolved #401 standard (provider-consumer-graph protocol + SeamContract, webregistries) across repos and aggregate into one live provider-consumer model — the engine every platform-manager surface reads. npm+git stay the source of bytes; this tracks relationships. The licensed half of the #092 ruling (open standard #401 already shipped). Root slice: impact-analysis, drift-detection, governance-UI and platform-map all build on this aggregated model and are independent of each other.
