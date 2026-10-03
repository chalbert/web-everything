---
bornAs: xw539ty
kind: epic
parent: "2822"
status: open
dateOpened: "2026-10-01"
tags: []
---

# Delivery postmortem toggle: turn on a root-cause postmortem for an operation or a whole item delivery, configured by target, criteria and frequency

Operator, 2026-10-01: a Plateau toggle that switches on the improvement postmortem the orchestrator has been doing by hand (root-cause each failure, file the product fix, prove it on the live case). Configurable: TARGET (one operation kind such as fix, review, build, ci-heal, verify; one item; a whole item delivery end to end; a repo or area), CRITERIA (always; only on failure or stand-down; when a PR did not move between two checks; when rounds exceed N; when wall time or cost exceeds a limit), FREQUENCY (every run, sampled 1 in N, daily digest), and DEPTH (quick classification or full transcript read). Output per run: what slowed or broke it, why, and the filed prevention card, per the step-local loop of #2822. A delivery-policy dimension (#4376) so defaults live per project. Related: #4365 (postmortem on every merge conflict), #2772 (forensics for a stalled lane).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
