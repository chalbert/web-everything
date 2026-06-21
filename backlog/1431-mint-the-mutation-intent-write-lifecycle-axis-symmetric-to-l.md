---
kind: story
size: 5
status: open
blockedBy: ["1395"]
relatedProject: webintents
dateOpened: "2026-06-21"
tags: []
---

# Mint the mutation intent — write-lifecycle axis symmetric to loader

Ratified by #1395 Fork 1(a): mint a first-class `mutation` intent owning the write-lifecycle axis (strategy optimistic/pessimistic · rollback · reconcile · doubleSubmit · busy), symmetric to `loader` for reads. Author we:src/_data/intents/mutation.json + its /intents/ page + nav. Default strategy = pessimistic (always-safe; optimism is the opt-in). Draws on `action` for trigger visual-weight; composes `reliability` for the failure branch. Unblocks the resource-action retarget.
