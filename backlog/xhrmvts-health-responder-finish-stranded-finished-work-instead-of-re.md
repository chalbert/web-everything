---
kind: story
size: 3
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-responder-stranded-finish.mjs", "we:scripts/conveyor/__tests__/health-responder-stranded-finish.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: finish stranded finished work instead of releasing it

Operator, 2026-10-02. On 2026-10-01 seven job lanes held finished, verified-green commits that were never opened as PRs (a record-lookup bug); releasing them, as story xiek6my proposes for stranded lanes, would have discarded the work. When a stranded lane holds committed work whose verify record is green, the responder finishes it: re-verify, then open the PR through the declared open-pr operation, then release. It never commits uncommitted changes and never pushes to an existing PR branch. Every step is a decision-log record. Replay: the 2026-10-01 lanes (#4416, #4447, #4429, the #4623/#4624 splits).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
