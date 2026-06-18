---
type: issue
workItem: story
size: 3
parent: "872"
status: open
dateOpened: "2026-06-18"
tags: []
---

# First real publish of @webeverything/contracts + migrate a consumer from dev path-mapping to the pinned published dep

The #872 endgame step that #877's CI pipeline enables but does not perform: actually bump @webeverything/contracts off the placeholder 0.0.0, publish it (via the #877 contracts-v* tag workflow), and migrate a consumer (FUI and/or plateau-app) from the #878 dev-time path-mapping (../webeverything/contracts source) to a PINNED @webeverything/contracts dependency in package.json. Until this lands, no consumer pins a version and the contract can't skew — which is why the #876 version-skew drift gate has nothing to check (verified batch-2026-06-17: neither FUI nor plateau-app declares a @webeverything/contracts dep; version is 0.0.0). This creates the version-skew surface #876 guards. Separately-prioritized (#804 2b, 'no hurry').
