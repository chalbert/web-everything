---
kind: story
size: 3
parent: "3984"
status: open
scope: ["we:scripts/lib/provider-routing.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# build-dispatch daemon: learn Codex vs Claude routing from the scorebook

The build-dispatch daemon routes today only via the #3906 table, the #4034 critical-work gate and per-card deliveryAgent markers. Add a learning step: read the scorecard store outcomes per (provider, taskType) and propose (not apply) openForNonCritical rows / marker suggestions when Codex has enough clean trials, surfaced in the dry-run report for operator ratification.

## Done when

1. **Executable** — `node we:skills-src/conveyor/build-dispatch-daemon.mjs --dry-run --json` includes a `routingSuggestions` array derived from the scorecard store (per provider × taskType trial counts and outcomes), and its unit test proves no suggestion is applied without operator ratification.
