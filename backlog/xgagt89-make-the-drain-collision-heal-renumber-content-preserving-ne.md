---
kind: story
size: 3
status: open
dateOpened: "2026-07-18"
tags: []
---

# Make the drain collision-heal renumber content-preserving (never blank a file)

we:scripts/backlog-renumber-collisions.mjs (the collision-heal backstop, #2291) blanked 6 files while rewriting hash/number cross-refs during the #558 land — the actual damage was data loss, not the collision. Harden it: assert the rewritten file body is byte-identical except the intended ref swap, and FAIL LOUDLY on any content delta rather than writing an empty/partial file. A safe renumber means a collision never loses authored content, even when hand-numbering or concurrent births slip past the gate. Add a regression test reproducing the blank-on-rewrite.
