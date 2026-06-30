---
kind: story
size: 5
parent: "1963"
status: active
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
tags: []
---

# Devtools for comment-anchor directives — surface directive regions

Comment-anchor directives (the ForEach, ViewIf, ViewSwitch family on CustomComment) are zero-layout-node but show only as raw comments in devtools — the DevX gap that makes directives less ergonomic than elements. Build devtools support that surfaces directive regions (boundaries, bound state, nesting) so HTML-authored composition is inspectable. Ratified under #1963.
