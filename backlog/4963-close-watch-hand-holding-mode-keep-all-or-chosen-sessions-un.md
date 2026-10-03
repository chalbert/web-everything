---
bornAs: xyb2jwr
kind: epic
parent: "2551"
status: open
dateOpened: "2026-10-01"
tags: []
---

# Close-watch (hand-holding) mode: keep all or chosen sessions under live supervision that reads the transcript, redirects, and logs improvements as it goes

Operator, 2026-10-01: a mode that keeps all or some sessions (picked by item, operation kind, repo, or risk) under close watch. A supervisor (the user, or an automated supervisor model) reads each watched session transcript live, spots drift early (polling loops, scope creep, working against a newer decision, a full test suite run, stalls), reorients it through the redirect action of card 4697, and records improvement notes as it goes, filed as cards through the #2822 loop. Settings: which sessions, how often to check, when to step in on its own versus only flag to the operator, and a token budget for the watching itself. Live precedent the same day: the orchestrator relayed the operator split decision to the #3311 fixer mid-run. Builds on the steer and live-tail parts of #2551; the read-only transcript check already exists as the inspect-agent-health skill.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
