---
kind: story
size: 2
parent: "1294"
status: open
blockedBy: ["1801"]
dateOpened: "2026-06-26"
tags: []
---

# Delete the WE webpolicy runtime (keep contract + vectors)

Delete we:webpolicy/enforcement.ts + we:webpolicy/proof.ts + their __tests__ (the runtime graduated to FUI in W1, demo repointed in W3). Keep we:webpolicy/contract.ts (the WE contract) + we:conformance-vectors/webpolicy.vectors.ts. Completes the webpolicy #1282 end-state. Blocked on the docs repoint (W3) so the demo never strands.
