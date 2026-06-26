---
kind: story
size: 3
parent: "1294"
status: open
blockedBy: ["1799"]
dateOpened: "2026-06-26"
tags: []
---

# webpolicy conformance binding + WE vector corpus

Author the webpolicy conformance: a FUI synchronous facts→verdict binding (dispatch(setFacts)/observe('verdict'), the #1789 SynchronousConformanceBinding) over the relocated FUI engine, plus the WE vector corpus we:conformance-vectors/webpolicy.vectors.ts (facts→golden verdict + proof-chain checks). Uses the #1790 plateau runner. Blocked on the FUI engine (W1).
