---
kind: story
size: 3
status: open
blockedBy: ["1318"]
dateOpened: "2026-06-20"
tags: []
---

# Revisit whether Action level models outcome-role (continue/cancel/back) not just prominence

Raised during #1318. Action Intent's `level` (primary | secondary | tertiary | destructive) is documented in we:src/_data/intents/action.json as 'semantic weight determining visual prominence' — but primary/secondary often carry an outcome-role (primary = continue/confirm, secondary = back/cancel) that prominence alone does not capture. Distinct from the now-ratified `variant` (presentational) axis. Investigate whether action disposition/role deserves its own modelling, or whether `level` already adequately stands in. Low priority, exploratory.
