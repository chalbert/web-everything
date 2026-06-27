---
kind: story
size: 2
parent: "1294"
status: open
blockedBy: ["1810"]
dateOpened: "2026-06-27"
tags: []
---

# Delete the WE webcompliance runtime (keep contract + vectors)

C5 of the webcompliance relocation cascade (#1294). Delete we:webcompliance/gate.ts + we:webcompliance/waiver.ts + we:webcompliance/audit.ts + their __tests__ (runtime graduated to FUI in C2, docs page wired in C4). Keep we:webcompliance/contract.ts (the WE contract) + we:conformance-vectors/webcompliance.vectors.ts. Completes the webcompliance #1282 end-state: impl→FUI, contract+vectors→WE. Blocked on the docs page (C4) so nothing strands.
