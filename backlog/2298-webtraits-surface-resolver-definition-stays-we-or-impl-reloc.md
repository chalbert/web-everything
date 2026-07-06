---
kind: decision
parent: "1294"
status: open
priority: low
dateOpened: "2026-07-06"
tags: [constellation-placement, relocation, webtraits, conformance]
---

# webtraits surface resolver — definition (stays WE) or impl (relocates to FUI)?

we:webtraits/surfaceIntentResolver.ts was resolved WE-resident definition by #1911, but its surfaceCss() emits a full CSS-ruleset string — the same shape as webtheme's compileToCss which the #1294 cascade relocated to FUI (conformance judged on the resolved structure, not the string, per #1816). Decide: definition (stays WE) or impl (relocate like webtheme). Ratifying unblocks a mechanical 5-slice cascade. Parked; blocks nothing live.
