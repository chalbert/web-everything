---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, meter, gauge, apg, gap]
---

# Meter / gauge — quantitative readout standard: placement

Surfaced by the ARIA-APG lens ([#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)):
a **meter** is a static quantitative readout within a known range (disk usage, score, capacity, password
strength) — `role=meter` / native `<meter>` — distinct from a *progress* indicator (task completion over
time) and from `status-indicator` (discrete state). WE has `status-indicator` and `loader` but **no
bounded-scalar-value readout**.

**Decision:** is meter covered by `status-indicator` (verify), a new dimension of it, or its own tiny
standard; and is `progress` (determinate/indeterminate task progress) a sibling gap to file alongside it.
Native-first: `<meter>` and `<progress>` elements. Ref:
[we:src/_data/blocks/status-indicator.json](../src/_data/blocks/status-indicator.json),
[we:src/_data/intents/status-indicator.json](../src/_data/intents/status-indicator.json). **Needs
`/prepare`.** Unsure ⇒ decision; costs nothing.
