---
bornAs: xscdebo
kind: story
size: 8
parent: "2804"
status: open
dateOpened: "2026-08-01"
blockedBy: ["2805", "2808"]
tags: [plateau-loop, conveyor, ui-fidelity, plateau-app, slice-uifg]
---

# Real-route render harness (plateau-app)

Generic harness that boots the shipped host shell at the contract route, seeds each regime through the real store, renders both themes in a REAL browser (jsdom forbidden), and emits per seed-and-theme a DOM snapshot, screenshot, and layout report, plus a signed conformance record bound to commit-route-baseline-hash.
