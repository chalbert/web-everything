---
kind: story
size: 3
parent: "1294"
status: open
blockedBy: ["1907"]
dateOpened: "2026-06-28"
tags: []
---

# webtheme conformance binding (deep-equal on resolveTokens) + WE vector corpus

T3 of the webtheme relocation cascade (#1294). Write the one-screen webtheme conformance binding that drives fui:webtheme resolveTokens and observes the resolved token map, plus its WE vector corpus in we:conformance-vectors/. Per #1816 the conformance subject is the resolveTokens map (NOT the compileToCss string), judged with the deep-equal matcher from the shared #1847 mechanism. Mirrors webcompliance C3 (#1809).
