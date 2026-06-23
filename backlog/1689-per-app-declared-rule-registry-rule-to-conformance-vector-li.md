---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
tags: []
---

# Per-app declared-rule registry + rule-to-conformance-vector linkage

Foundational substrate for the dev-browser conformance cluster: expose each app's declared conformance/visibility/validation rules as an enumerable per-app registry, and link each declared rule to the conformance vector(s) that exercise it (the @webeverything/conformance-vectors corpus already exists; the neutral runner is plateau:src/conformance-engine). Un-gates the standard-aware review assistant (#1640) and the declared-rule to test-coverage gap surfacer (#1641): #1640 reads the registry to judge a diff, #1641 computes coverage = rules-with-a-run-vector over all-declared-rules.
