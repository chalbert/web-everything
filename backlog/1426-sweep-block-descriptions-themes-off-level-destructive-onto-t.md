---
kind: task
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_includes/block-descriptions/action-button.njk"
tags: [webintents, action-intent, tone, destructive, migration]
relatedProject: webintents
---

# Sweep block descriptions + themes off level=destructive onto tone=danger (#1337 migration)

Migration sweep for the #1337 ruling, run after the `tone` dimension exists (#1425). Move every shipped
consumer of `level=destructive` onto `tone=danger`: we:src/_includes/block-descriptions/action-button.njk:164
and :199, we:src/_data/blocks/menu.json:18, plus any theme selector keying
`[data-action-intent="destructive"]`. Once no consumer references the deprecated alias, the alias can be
removed (final cleanup). Pure mechanical migration — no design decision; the end-state was ratified in
#1337.

## Progress

- Migrated the shipped consumers off `level=destructive` onto the `tone=danger` axis:
  - we:src/_includes/block-descriptions/action-button.njk — the live Delete-button example
    `action-intent="destructive"` → `action-intent="primary" tone="danger"`; the Styling-Hooks doc table
    now lists `[data-action-intent="primary|secondary|tertiary"]` (clean ordinal level) + a new
    `[data-tone="danger"]` row.
  - we:src/_data/blocks/menu.json — the Action-orthogonality prose updated from "primary/destructive" to
    "primary/secondary/tertiary level, plus a danger tone".
- No theme CSS keys `[data-action-intent="destructive"]` (grep of we:src/css confirms — only the doc
  table referenced it), so there is no stylesheet selector to migrate.
- Out of scope (left intact): the historical research-description njks describe the pre-#1337 model + the
  decision (records, not consumers). A minor stale prose example in we:src/_data/intents/command.json is
  noted for a future docs pass, not a `level=destructive` value consumer.
- The deprecated `level=destructive → tone=danger` alias in we:src/_data/intents/action.json stays — its
  removal is the separately-scoped final cleanup once nothing references it. Cleared the stale
  `blockedBy: ["1425"]` (resolved).
