---
kind: story
size: 5
status: open
dateOpened: "2026-07-18"
tags: []
---

# Mint the visual-diff intent — author the three-axis review-surface contract

Author the ratified visual-diff intent (#2538): a WE-owned annotated visual-diff review surface. Each delta region carries three orthogonal axes — structural type (added|removed|changed), nature (unplanned|expected), review disposition (unreviewed|accepted|rejected) — a tagged-union anchor (pixel-region|dom-selector|node-id|line-range), and a per-region disposition model (accepted promotes built→baseline; an expected region parks as known-pending) with whole-surface approve composing above it. Intent only — the differ seam is a separate standard (follow-on). Use the new-standard skill; measure against audit-timeline.
