---
kind: task
status: open
blockedBy: ["1425"]
dateOpened: "2026-06-21"
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
