---
kind: story
size: 3
status: open
dateOpened: "2026-07-02"
tags: []
---

# check:backlog-workflow — audit the workflow-intent invariants the schema validator cannot see

we:docs/agent/backlog-workflow.md defines invariants (sliced epics carry no size, unstoried epics do, born-active settlement, blockedBy targets not parked, Fibonacci sizes, tasks sizeless) that are enforced only by convention; under 15-plus concurrent lanes a race can leave an epic in an invalid state caught only in review. Add a deterministic validator for these workflow-intent rules alongside the existing schema checks.
