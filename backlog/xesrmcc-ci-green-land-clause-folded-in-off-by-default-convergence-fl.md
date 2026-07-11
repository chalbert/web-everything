---
kind: story
size: 3
parent: "2410"
status: open
blockedBy: ["xcey4lq", "xt1lxaj", "x9absz3"]
dateOpened: "2026-07-11"
tags: []
---

# CI-green land clause folded in + off-by-default convergence flag

Capstone: fold required-test-green into deriveNegotiationOutcome's land condition and retire the lane-resume test-red strand (we:scripts/lane-resume.mjs:81); wire the whole loop behind an off-by-default flag (we:scripts/lane-drain.mjs flag parsing), scoped to small/non-security diffs first. Blocked by A+B+C. Slice D of epic #2410.
