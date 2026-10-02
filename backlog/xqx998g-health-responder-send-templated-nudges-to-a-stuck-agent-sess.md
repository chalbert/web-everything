---
kind: story
size: 3
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v", "x1jbzem"]
scope: ["we:scripts/conveyor/health-responder-nudge.mjs", "we:scripts/conveyor/__tests__/health-responder-nudge.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: send templated nudges to a stuck agent session

Operator, 2026-10-02: the responder may message a live daemon-dispatched agent session to reorient and unstick it, in parallel with the root-cause work. Narrow: only a fixed set of reviewed message templates (for example: you are polling, use one blocking wait; the PR you are fixing was superseded or split, stop; the red check is a test outside your diff, report and stop; your claim was released, stop), only to sessions the responder can identify as daemon-dispatched for that PR, through the redirect mechanism of card x1jbzem. A nudge never grants approval, never widens scope and never carries free text; the session must acknowledge or stop, and an unanswered nudge escalates. Free-text redirection stays with the operator or orchestrator. Every nudge and reply is a decision-log record and a PR comment.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
