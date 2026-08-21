---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# bootstrap installs the PR-watch allow rules, so a fresh VM does not re-prompt

A cloud VM `$HOME` is reclaimed on idle, so a `permissions.allow` entry added by hand is gone by the next session and gets re-approved every time. `we:scripts/bootstrap-session.mjs` already makes machine state travel — the SessionStart hook and the primary `.git` grant — but nothing wrote `permissions.allow`. Adds `withToolAllowlist`, purely additive so it can never drop an operator rule, behind the same write-consent as every other effect. Only server-stable `mcp__github__*` names are committed: the harness also serves these tools from a session-scoped server whose id is a bare uuid, and committing that would be the `/Users/<name>/...` defect this file already warns about.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
