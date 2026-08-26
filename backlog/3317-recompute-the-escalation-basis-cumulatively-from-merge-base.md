---
bornAs: xi6608w
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/review-escalation.mjs
tags: []
---

# Recompute the escalation basis cumulatively from merge-base

changedFiles and diffLines may be an own-delta baseRev..head of a stacked lane, and base is self-declared; only humanBasisFiles is forced cumulative today. That makes both the size signal and blast-radius evadable by declaring a stacked base, and by the sanctioned slice-into-two-PRs workflow. Recompute every signal from merge-base(origin/main, head). Deterministic, no model, and a prerequisite for treating size as anything stronger than a signal.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
