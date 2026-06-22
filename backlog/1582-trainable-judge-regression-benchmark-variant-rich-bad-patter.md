---
kind: story
size: 5
parent: "1552"
status: open
blockedBy: ["1580"]
dateOpened: "2026-06-22"
tags: []
---

# Trainable-judge regression benchmark — variant-rich bad-pattern catalogue + false-positive traps

Build the curated, held-out regression benchmark that makes the trainable judge (#1553) trustworthy: a catalogue of bad patterns with MANY variants each (reflow/theme/density/locale/animation phase) so a judge can't pass by memorizing one frame, PLUS a large negative set of deliberate false-positive traps (plausible-but-correct states it must NOT flag — FP rate is a first-class scored metric). Strictly train-disjoint (split applied at #1580 ingestion, never crossed). Scores OUTPUTS, so it validates any judge agent (the portable yardstick). CI-gated on accuracy even though the judge's output never gates an explored run (#1172). Per we:docs/agent/platform-decisions.md#trainable-judge.
