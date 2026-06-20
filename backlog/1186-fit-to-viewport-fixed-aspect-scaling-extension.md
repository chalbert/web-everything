---
kind: story
status: resolved
size: 2
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/semantics/fit.json
relatedProject: webpositioning
tags: [deck, fit, scaling, webpositioning]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Fit-to-viewport fixed-aspect scaling — extend the fit semantic

Extend the `fit` semantic with an **aspect-ratio lock + scale-factor contract** (`scale = min(vw/baseW, vh/baseH)` clamped) — CSS alone can't derive the contain factor, so a ResizeObserver `--fit` shim is part of the contract. Footguns to bake as conformance: blurry sub-pixel text and **broken pointer hit-testing under scale**. Homed in **webpositioning**. *Updated/extension.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress

Resolved 2026-06-20. Extended the `fit` semantic (we:src/_data/semantics/fit.json) with the fit-to-viewport
fixed-aspect-ratio variant:

- **Scale-factor contract:** a base design size `baseW × baseH` uniformly scaled by
  `scale = min(vw/baseW, vh/baseH)`, clamped to configured min/max — letterboxes a fixed-aspect surface
  into the viewport (the deck-slide / fixed-canvas case), beside the existing Cover/Contain/Fill.
- **Shim is part of the contract:** CSS alone can't derive the contain factor (no `min(vw/baseW, vh/baseH)`
  primitive over two intrinsic axes), so a ResizeObserver-driven `--fit` custom-property shim that writes
  the computed scale is mandated (applied via `transform: scale(var(--fit))` on a fixed base-size stage) —
  not an optional enhancement.
- **Footguns baked as required conformance:** (1) blurry sub-pixel text → device-pixel-aligned transforms
  / prefer `transform` over `zoom`; (2) broken pointer hit-testing under scale → coordinates in a
  `transform: scale()` subtree unscaled before hit-testing, with a vector asserting a click at a scaled
  coordinate resolves to the correct logical target.

Homed in webpositioning. The runtime shim impl is FUI; this WE change is the semantic/contract extension.
Gate green.
