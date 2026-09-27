---
kind: story
size: 5
parent: "4075"
status: open
dateOpened: "2026-09-27"
tags: []
---

# Run rating: could-this-have-been-prevented check on every change request, with cause classes + recurrence to system fix

Slice (c) of run rating & efficiency (parent #4075). Every `review:changes` bounce already carries a cause once
a human or judge writes one down, but nothing asks the follow-up question systematically: could a hook, a
brief, or a gate have caught this BEFORE the round happened? This item classifies every change request into a
declared closed set of cause classes, tracks recurrence per class, and — per this repo's own "failures improve
the product" doctrine — flags a class that recurs past a threshold as needing a system fix (a hook, a brief
edit, a gate) rather than another manual review round.

## Done when

1. **Executable** — a command reads recent change-request rounds, classifies each by cause, and reports
   recurrence counts per class with the ones over threshold flagged for a system fix, runnable against a
   fixture and against real recent PR review history.
