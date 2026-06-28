---
kind: task
parent: "1391"
status: open
locus: plateau-app
blockedBy: ["1753"]
dateOpened: "2026-06-24"
tags: []
---

# Dev-browser shell — license-gating wiring (commercial-use license + server-cost-tier check)

Wire the two orthogonal gates ratified by #1655: Gate-1 a commercial-use license check covering the whole local browser (non-commercial/OSS/learning = free across every local feature), Gate-2 a server-cost-tier check gating any capability that requires a server to run (paid for all). No per-capability free/paid flag table. Home plateau:src/dev-browser/shell/.
