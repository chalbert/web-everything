---
kind: story
status: open
size: 2
dateOpened: "2026-06-20"
relatedProject: webpositioning
tags: [deck, fit, scaling, webpositioning]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Fit-to-viewport fixed-aspect scaling — extend the fit semantic

Extend the `fit` semantic with an **aspect-ratio lock + scale-factor contract** (`scale = min(vw/baseW, vh/baseH)` clamped) — CSS alone can't derive the contain factor, so a ResizeObserver `--fit` shim is part of the contract. Footguns to bake as conformance: blurry sub-pixel text and **broken pointer hit-testing under scale**. Homed in **webpositioning**. *Updated/extension.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*
