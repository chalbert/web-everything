---
bornAs: xscdebo
kind: story
size: 8
parent: "2804"
status: open
blockedBy: ["2805", "2808"]
scope:
  - plateau-app:scripts/dev/fidelity-render.mjs
dateOpened: "2026-08-01"
tags: [plateau-loop, conveyor, ui-fidelity, plateau-app, render-slice, human-verify, slice-uifg]
---

# Real-route render harness (plateau-app)

Generic harness (`plateau-app:scripts/dev/fidelity-render.mjs`, sibling of the existing
`plateau-app:tests/visual/capture.mjs`) that boots the shipped host shell at the contract route, seeds each
regime through the real store [#2808], renders both themes in a REAL browser (jsdom forbidden), and emits per
seed×theme a DOM snapshot, screenshot, and layout report, plus a signed conformance record bound to
commit×route×baseline-hash.

## Conveyor guardrail — self-proving, human-verify
**Do NOT auto-resolve on tests-green alone.** This slice builds the very oracle that was missing, so it must
prove itself against a KNOWN-BAD target:

- **Run the harness against the CURRENT `/console-board` and it must RED-flag it** — capture the live defect
  signals (`laneCols=0`, ≥2 `<header>`/brand marks, `poolChips≤1`, empty center). If the harness green-lights
  today's board, the harness is wrong.
- It must mount the **real route in the host shell** (not `?demo=1`); a harness that renders a fixture repeats
  the original failure and is rejected.
- **Requires a rendered red→green proof, human-reviewed** — attach the red capture of today's board. This is a
  `render-slice`: resolve gates on the rendered proof, not on a green unit suite.
