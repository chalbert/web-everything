---
kind: story
size: 2
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/action.json"
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

## Progress

- Edited we:src/_data/intents/action.json: removed `destructive` from `level.values` (clean ordinal
  `primary | secondary | tertiary`); added open-numbered `tone` dimension (core `neutral | danger`,
  `success|warning|info` extensible-but-not-blessed per #1318); documented the deprecated
  `level=destructive → tone=danger` migration alias on the `level` description.
- Updated the rendered `description` HTML: dropped the destructive `<li>`, added a `Tone` section, and
  updated the TS protocol (`ActionLevel` drops destructive, new `ActionTone`, `ActionIntent.tone?`).
- Consumers (we:src/_includes/block-descriptions/action-button.njk, we:src/_data/blocks/menu.json, any `[data-action-intent="destructive"]` theme keying) are
  left untouched — the deprecated alias keeps them valid; the sweep onto `tone=danger` is #1426.
