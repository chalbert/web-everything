---
kind: task
parent: "3573"
status: open
blockedBy: ["3573"]
scope: ["we:scripts/conveyor/infra-blocked.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Log gh api rate_limit remaining/used on every we:scripts/conveyor/infra-blocked.mjs retry trip

Ratified by #3573 (fork c, instrument first): on every we:scripts/conveyor/infra-blocked.mjs retry trip (the 'retry' subcommand's per-entry resume-attempt loop, ~line 591-621), call gh api rate_limit and log the core bucket's remaining/used figures alongside the existing per-attempt log line — cheap, no auth-surface change. Gives a future revisit of #3573 real usage data to check sustained pressure against, instead of the no-live-bottleneck-tonight snapshot the ratification was made on.

## Done when

1. **Executable** — a new test in `we:scripts/conveyor/__tests__/` (the nearest existing suite for
   `we:scripts/conveyor/infra-blocked.mjs`) that fails before this item lands and passes after: a fixture
   where a mocked `gh api rate_limit` call returns a core bucket `{remaining, used}` pair, asserting the
   `retry` subcommand's per-entry resume-attempt loop logs both figures alongside its existing per-attempt
   log line (`we:scripts/conveyor/infra-blocked.mjs:618-620`).
2. **Observable** — running `node we:scripts/conveyor/infra-blocked.mjs retry` against a live `gh api
   rate_limit` actually prints the core bucket's `remaining`/`used` figures on each retry trip, not only on a
   surfaced/capped entry.
3. **Assertable** — the added call reuses `gh api rate_limit`'s existing response shape (`resources.core.
   remaining`/`.used`) and requests no new scope or auth surface — matching #3573's "cheap, no auth-surface
   change" premise for fork (c); the PR body names the exact log line shape chosen.
