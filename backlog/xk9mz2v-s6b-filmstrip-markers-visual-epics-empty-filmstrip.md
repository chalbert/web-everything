---
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["x9cuge3", "2688"]
scope: ["plateau-app:src/feature-tracker/markers-filmstrip.ts", "plateau-app:src/feature-tracker/markers-filmstrip.css"]
dateOpened: "2026-07-27"
tags: []
---

# S6b · Filmstrip markers (visual epics) + empty-filmstrip

Visual-epic filmstrip (shipped/current/draft frames + ghost projected-next) fed by #2688 design-increment snapshots. Explicit named surface + own baseline for M24 (filmstrip empty: honest 'no snapshots').

## Deliverable
A visual-epic FILMSTRIP (shipped/current/draft frames + a ghost projected-next), fed by #2688 design-increment snapshots. Explicit named surface + own baseline for M24 (filmstrip empty: an honest "no snapshots", never a lost/broken frame).

## FT cases → rendered=yes
F8; M24–M27.

## Scope
- `plateau-app:src/feature-tracker/markers-filmstrip.ts`
- `plateau-app:src/feature-tracker/markers-filmstrip.css`

## Acceptance
Frames come from #2688 snapshots (empty/single/many/ghost honest); M24 renders the honest empty note with its own baseline; matches baseline in both themes.
