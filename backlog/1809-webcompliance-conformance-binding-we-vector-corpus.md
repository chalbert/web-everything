---
kind: story
size: 3
parent: "1294"
status: open
blockedBy: ["1814"]
dateOpened: "2026-06-27"
tags: []
---

# webcompliance conformance binding + WE vector corpus

C3 of the webcompliance relocation cascade (#1294). Author a FUI synchronous facts→verdict binding (dispatch(setPolicy/setSignals) / observe('blocked'/'violations'), the #1789 SynchronousConformanceBinding) over the relocated gate, plus the WE vector corpus we:conformance-vectors/webcompliance.vectors.ts (signals+policy → golden gate verdict + waiver/expiry checks). Driven by the #1790 plateau runner. Blocked on the FUI engine (C2).
