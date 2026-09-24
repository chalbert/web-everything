---
bornAs: xaw0di9
kind: story
size: 5
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
---

# Planner build: step operations and permissions (in-lane ops, request-run, request-scope, step deny table)

Child 5 of #3922. The first in-lane declared operations (at least test-related), request-run and request-scope operations that record a request for the wrapper to decide, the per-step settings file (edit only filesTouched, only pre-approved operations, no free shell, hooks attached), and a step deny table in guard-bash enforcing the gate schedule for WE_DISPATCH_KIND=step.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
