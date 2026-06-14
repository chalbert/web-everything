---
type: issue
workItem: story
size: 2
status: open
dateOpened: "2026-06-14"
tags: []
---

# Recognize shadowrootmode as accepted alias of shadow= on <component>

Current-state fix surfaced by the #607 audit (strictness finding #045, fake-invariant/pre-rule). Decision #045 baked shadow="open|closed|none" as the sole authoring spelling while conceding the native DSD shadowrootmode spelling is legitimate ("1:1 platform familiarity") and merely 'held as a possible future alias'. The open|closed sub-axis is exactly 1:1 with shadowrootmode; only the light-DOM 'none' case is a genuine superset justifying shadow= as the DEFAULT. Per most-flexible-default and the same-batch #046 precedent (default tag + recognized alias), recognize shadowrootmode as an accepted alias of shadow= so the native platform spelling is supported, not withheld. Authoring-vocabulary alias only; no behavior change.
