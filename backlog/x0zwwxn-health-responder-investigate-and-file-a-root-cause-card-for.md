---
kind: story
size: 5
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-responder-rootcause.mjs", "we:scripts/conveyor/__tests__/health-responder-rootcause.test.mjs", "we:scripts/conveyor/health-investigate-dispatch.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: investigate and file a root-cause card for repeated problems

Operator, 2026-10-02: "if we want to mechanise some of your job it has to at least try" — the responder must not only fix instances, it must try to fix the cause, as the orchestrator did all day on 2026-10-01 (dig into the cause, file a card, queue the fix). When the same smell class recurs (threshold proposed in the design, e.g. 3 episodes of one class within 24h, or an actionable episode the responder could not resolve), the responder (1) dispatches ONE diagnose-only investigation through the existing we:scripts/conveyor/health-investigate-dispatch.mjs (read-only tools, wall clock, findings land in the episode report), then (2) files ONE root-cause card through the declared file-item operation carrying the investigator hypothesis plus the evidence (PRs, timelines, decision-log records), de-duplicated per smell class and per open card, and queued for the normal prepare, build and review. It never writes code and never builds the fix itself. Every step is a decision-log record (investigation dispatched, findings, card filed or skipped as duplicate). Allowlist additions: investigate-dispatch and file-root-cause-card. Replay: the 2026-10-01 no-label cluster (#3239, #3389-#3392, #3463, #3471) yields one investigation and one card whose cause matches PR #3475.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
