---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: block:trusted-html-behavior
tags: []
---

# Build + demo the trusted-html-behavior block (graduate from orphan)

Owner for the orphan trusted-html-behavior block (#1041, audit §9): build the attribute-behavior that enforces a Trusted Types policy on an element's innerHTML mutations (TrustedHTML). Per bias-toward-separation it is the composable BEHAVIOR form (attribute on any element), distinct from the trusted-html block (the dedicated element form) it composes with — own, do not fold. Build the behavior + a runtime demo, then status draft->active. Block: we:src/_data/blocks/trusted-html-behavior.json.
