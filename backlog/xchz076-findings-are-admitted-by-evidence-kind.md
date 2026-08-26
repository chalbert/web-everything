---
kind: story
size: 5
parent: "xjbdhzb"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Findings are admitted by evidence kind

A finding blocks only when it carries machine-checkable evidence — a repro, an embedded re-runnable command, or a resolved citation whose source text is quoted. Assertion-only findings advise and never block, and self-rated severity leaves the gate entirely (it is measured near-random). BLOCKED on suite runtime: test:unit is 693s against a 20-minute juror kill, so a red-before/green-after repro does not fit inside a review.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
