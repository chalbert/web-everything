---
bornAs: xe0k9el
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2725", "2727", "2732", "2726", "2731", "2728", "2729", "2723", "2722", "2724"]
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
