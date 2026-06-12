---
type: idea
workItem: story
size: 5
status: open
blockedBy: ["331", "332"]
dateOpened: "2026-06-11"
tags: [mock, proxy, contract, drift, webcases, verification]
---

# Mock-vs-real drift check in webcases

Add a mock-vs-real drift check in `webcases`: verify the same interaction-bearing mock/contract artifact (#331) against the live service so a mock that has drifted from reality is caught. Reuses the dev-server provider (#332) to record/replay real responses. Ratified in #107 (Fork 3): one contract, two uses — the artifact that mocks an endpoint is the same one verified against the real service, with `webcases` as the verification home, because schema-validation is not contract-verification. Blocked on both the schema (#331, the artifact) and the dev-server provider (#332, the real-traffic source).
