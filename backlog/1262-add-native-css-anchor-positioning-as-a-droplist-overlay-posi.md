---
kind: story
size: 3
parent: "1257"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Add native CSS anchor positioning as a droplist/overlay positioning strategy

CSS anchor positioning now ships in all engines (Firefox 147 stable Jan 2026, Safari 26), approaching Baseline. Resolved #149 implemented positioning via a floating-ui DI strategy; native-first (#031) says add a native-anchor-positioning strategy as an additional and eventually default resolver, gated on cross-browser stability. Follows #149 and #136 (anchor trait behavior). Surfaced by the 2026-06-20 platform-standards watch (#1257).
