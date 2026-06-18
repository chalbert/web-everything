---
type: idea
workItem: story
size: 3
parent: "315"
status: open
blockedBy: ["736", "896"]
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# temporal block impl — datetime-picker preset + build-chunk dogfood (#713)

Wire the datetime-picker preset (composes calendar-grid + clock over `<input type=datetime-local>`) per the WE datetime-picker contract, then author the #713 build-chunk dogfood: a PRODUCTION-build assertion that a time-only fixture pulls no calendar chunk (and a date-only fixture pulls no clock chunk) — per-preset trait isolation. Capstone of the temporal IMPL track. blockedBy #736 (calendar-grid) + #896 (clock) — both chunks must exist to prove isolation, and datetime-picker composes both surfaces. Sibling slice under #315 (/slice 736). Generic cross-bundler chunk-isolation conformance is separately owned by #720/#722. Demo: green chunk-isolation test on a real build.
