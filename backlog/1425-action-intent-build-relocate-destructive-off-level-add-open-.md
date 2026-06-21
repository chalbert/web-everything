---
kind: story
size: 2
status: open
blockedBy: []
dateOpened: "2026-06-21"
tags: [webintents, action-intent, tone, destructive, migration]
relatedProject: webintents
---

# Action Intent build: relocate destructive off level, add open-numbered tone dimension (core neutral|danger) + deprecated level=destructive→tone=danger alias (#1337)

Realizing build for the #1337 ruling. Two edits to we:src/_data/intents/action.json: (1) remove
`destructive` from the `level` values, leaving the clean ordinal `primary | secondary | tertiary`; (2)
add an open-numbered `tone` dimension (per the #1318 open-numbered-variants contract) with recommended
core `neutral | danger` — `success | warning | info` are author-extensible but NOT blessed on action.
Plus the migration: keep `level=destructive` as a deprecated alias mapping to `tone=danger` (default
prominence) during transition. The alias lets this land first; the consumer sweep onto `tone=danger`
(#1426) follows, then a later cleanup removes the alias. Shipped consumers per #1337 blast-radius:
we:src/_data/intents/action.json:16,
we:src/_includes/block-descriptions/action-button.njk:164 and :199, we:src/_data/blocks/menu.json:18,
plus any theme keying `[data-action-intent="destructive"]`.
