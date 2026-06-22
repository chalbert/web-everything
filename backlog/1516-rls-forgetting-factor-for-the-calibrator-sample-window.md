---
kind: story
size: 3
status: open
blockedBy: ["1515"]
dateOpened: "2026-06-22"
tags: []
---

# RLS forgetting-factor for the calibrator sample window

Replace the hard 12-sample window in we:scripts/backlog/capacity.mjs with recursive least squares + a forgetting factor (lambda approx 0.98-0.995) so a regime change (model swap, shifted context economics) ages out smoothly rather than by a hard cutoff. The online successor to hard windowing, adopted once the pooled affine estimator (#1515) lands. Ratified in #1505 (Supported by default).
