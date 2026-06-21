---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, bulk-actions, selection, gap]
---

# Bulk actions over a multi-selection — selection action bar + batch operations standard: placement

Surfaced by the production-app teardown lens
([#1404](/backlog/1404-discovery-lens-production-app-teardown-inventory-real-apps-d/), Linear walk): selecting
several rows reveals a **contextual action bar** offering operations applied to the **whole selection** (move,
assign, label, delete), with select-all / clear-selection affordances and an a11y announcement of "N
selected". This recurs across Gmail, Linear, Google Drive, Notion, file managers — a *general* pattern, not
app-specific.

WE owns the pieces but not the composition: [selection](../src/_data/intents/selection.json) models the
*choice* (which items are selected), [command](../src/_data/intents/command.json) / `action` model a *single*
invocation. Neither owns the **batch-apply surface**: an action bar bound to the live selection set, fanning
one command across N targets, with select-all/clear + count announcement + post-action focus return.

**Decision (placement-unsure ⇒ decision):** a `bulk-action` intent composing `selection` + `command` over a
target set **vs** a `selection` extension (a "selection actions" trait) **vs** a headless behavior. The
recurring select-all/clear/announce mechanics suggest a real unit. Refs:
[we:src/_data/intents/selection.json](../src/_data/intents/selection.json),
[we:src/_data/intents/command.json](../src/_data/intents/command.json),
[we:src/_data/blocks/selection.json](../src/_data/blocks/selection.json). **Needs `/prepare`.** Unsure ⇒
decision; costs nothing.
