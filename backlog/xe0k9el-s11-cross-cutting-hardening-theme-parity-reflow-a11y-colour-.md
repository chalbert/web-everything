---
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["xwmr2vr", "xh6gf3t", "xxmgsqq", "x9cuge3", "xx03ak0", "xk9mz2v", "xvo15ow", "xao3fqx", "x8itmee", "xpm9rzu"]
scope: ["plateau-app:src/feature-tracker/feature-tracker.css", "plateau-app:src/feature-tracker/scan.css", "plateau-app:src/feature-tracker/detail.css", "plateau-app:src/feature-tracker/dag.css"]
dateOpened: "2026-07-27"
tags: []
---

# S11 · Cross-cutting hardening — theme parity · reflow · a11y · colour↔text-twin

Over the assembled screen: dark/light token parity incl. SVG redraw on theme switch, narrow-viewport reflow without overflow, colour-cue-to-text-twin + hatch-over-solid colourblind audits.

## Deliverable
Over the assembled screen: dark/light token parity incl. SVG redraw on theme switch, narrow-viewport reflow (detail = full-screen push + back; charts/rails/filmstrip reflow without overflow), colour-cue↔text-twin + hatch-over-solid colourblind audits.

## FT cases → rendered=yes
R1–R4.

## Scope
- `plateau-app:src/feature-tracker/feature-tracker.css`
- `plateau-app:src/feature-tracker/scan.css`
- `plateau-app:src/feature-tracker/detail.css`
- `plateau-app:src/feature-tracker/dag.css`

## Acceptance
Both-theme baselines pass across every surface; narrow baselines pass with no horizontal body scroll; an automated test asserts every signal colour has a text/aria twin; the theme toggle re-renders all SVGs; the golden-master spot-check (R9) passes in both themes.
