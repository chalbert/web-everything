---
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["x9cuge3"]
scope: ["plateau-app:src/feature-tracker/markers-shiplog.ts", "plateau-app:src/feature-tracker/markers-shiplog.css"]
dateOpened: "2026-07-27"
tags: []
---

# S6a · Ship-log markers (build epics) + generic fallback

Build-epic ship-log (API/TEST rows with pass/pend/fail derived from slice endpoints/tests) + generic fallback for other kinds. Registers via rollup's marker slot.

## Deliverable
A build-epic SHIP-LOG (API/TEST rows with pass/pend/fail, derived from slice endpoints/tests — NO prereq) + a generic fallback for other kinds. Registers via rollup's marker slot.

## FT cases → rendered=yes
F9; M28–M31 (+M32 spec); M33.

## Scope
- `plateau-app:src/feature-tracker/markers-shiplog.ts`
- `plateau-app:src/feature-tracker/markers-shiplog.css`

## Acceptance
Ship-log rows reflect slice pass/pend/fail; the generic fallback renders for non-visual/non-build kinds; matches baseline in both themes.
