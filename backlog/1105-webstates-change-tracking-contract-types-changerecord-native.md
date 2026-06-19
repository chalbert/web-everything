---
type: idea
workItem: story
size: 2
parent: "1089"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webstates: Change-Tracking contract types + ChangeRecord + native default strategy

Materialize the change-tracking contract in we:plugs/webstates/CustomChangeStrategy.ts per spec we:src/_includes/project-webstates.njk:136-172 (ChangeRecord, ChangeSource, CustomChangeStrategy: key/track/diff/applyInverse) + a native store-subscription to ChangeRecord default; export from we:plugs/webstates/index.ts. Demo: unit test that a CustomStore.setItem yields a well-formed ChangeRecord.
